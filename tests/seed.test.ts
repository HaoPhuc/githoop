import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Redis stand-in: strings with SET NX, and lists with LPOP count / RPUSH / LPUSH.
const strings = new Map<string, string>();
const lists = new Map<string, string[]>();
const list = (k: string) => lists.get(k) ?? (lists.set(k, []), lists.get(k)!);
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (k: string) => strings.get(k) ?? null,
    set: async (k: string, v: string, ...opts: unknown[]) => {
      if (opts.includes("NX") && strings.has(k)) return null;
      strings.set(k, v);
      return "OK";
    },
    del: async (k: string) => Number(strings.delete(k)),
    lpop: async (k: string, n: number) => {
      const out = list(k).splice(0, n);
      return out.length ? out : null;
    },
    rpush: async (k: string, ...v: string[]) => list(k).push(...v),
    lpush: async (k: string, ...v: string[]) => list(k).unshift(...v.reverse()),
    llen: async (k: string) => list(k).length,
  },
}));

const scoutCard = vi.fn();
vi.mock("@/lib/scout", () => ({ scoutCard: (l: string) => scoutCard(l) }));
const recorded = new Set<string>();
vi.mock("@/lib/registry", () => ({
  unrecorded: async (ls: string[]) => ls.filter((l) => !recorded.has(l)),
}));
const followerRankPage = vi.fn();
vi.mock("@/lib/github/search", () => ({ followerRankPage: (n: number | null) => followerRankPage(n) }));

import { seedRun } from "@/lib/seed";

const QUEUE = "githoop:seed:v1:queue";
const CURSOR = "githoop:seed:v1:cursor";

beforeEach(() => {
  strings.clear();
  lists.clear();
  recorded.clear();
  scoutCard.mockReset().mockImplementation(async (l: string) => ({ login: l }));
  followerRankPage.mockReset();
});

describe("seedRun", () => {
  it("walks down the follower ranking, skipping players already on the board", async () => {
    recorded.add("b");
    followerRankPage
      .mockResolvedValueOnce({ logins: ["a", "b", "c"], lowest: 500 })
      .mockResolvedValueOnce({ logins: ["d"], lowest: 120 })
      .mockResolvedValueOnce({ logins: ["e"], lowest: 90 });

    const report = await seedRun(10_000);
    expect(followerRankPage.mock.calls.map((c) => c[0])).toEqual([null, 499, 119]);
    expect(scoutCard.mock.calls.map((c) => c[0])).toEqual(["a", "c", "d", "e"]);
    expect(report).toEqual({ scouted: 4, failed: 0, queued: 0, stopped: "pages" });
    expect(strings.get(CURSOR)).toBe("89");
  });

  it("drains the queue before fetching another page", async () => {
    lists.set(QUEUE, ["x", "y"]);
    strings.set(CURSOR, "1000");
    followerRankPage.mockResolvedValue({ logins: [], lowest: null });

    const report = await seedRun(10_000);
    expect(scoutCard.mock.calls.map((c) => c[0])).toEqual(["x", "y"]);
    expect(followerRankPage).toHaveBeenCalledWith(1000);
    expect(report).toMatchObject({ scouted: 2, stopped: "exhausted" });
    expect(strings.get(CURSOR)).toBe("-1");
    // Once exhausted, later runs don't search again.
    followerRankPage.mockClear();
    expect(await seedRun(10_000)).toMatchObject({ scouted: 0, stopped: "exhausted" });
    expect(followerRankPage).not.toHaveBeenCalled();
  });

  it("drops profiles that fail and requeues the rate-limited ones", async () => {
    lists.set(QUEUE, ["gone", "ok", "limited", "later"]);
    scoutCard.mockImplementation(async (l: string) => {
      if (l === "gone") throw { type: "notfound", message: "" };
      if (l === "limited") throw { type: "ratelimit", message: "" };
      return { login: l };
    });

    const report = await seedRun(10_000);
    expect(report).toEqual({ scouted: 2, failed: 1, queued: 1, stopped: "ratelimit" });
    expect(lists.get(QUEUE)).toEqual(["limited"]);
  });

  it("stops at the time budget", async () => {
    lists.set(QUEUE, ["a", "b", "c", "d", "e", "f"]);
    expect(await seedRun(0)).toEqual({ scouted: 0, failed: 0, queued: 6, stopped: "time" });
  });

  it("refuses to overlap another run, and releases its lock", async () => {
    strings.set("githoop:seed:v1:lock", "1");
    expect(await seedRun(10_000)).toBe("busy");
    strings.clear();
    followerRankPage.mockResolvedValue({ logins: [], lowest: null });
    await seedRun(10_000);
    expect(strings.has("githoop:seed:v1:lock")).toBe(false);
  });

  it("reports a search failure instead of throwing", async () => {
    followerRankPage.mockRejectedValue({ type: "network", message: "GitHub search failed (502)." });
    expect(await seedRun(10_000)).toEqual({
      scouted: 0,
      failed: 0,
      queued: 0,
      stopped: "error",
      error: "GitHub search failed (502).",
    });
  });
});
