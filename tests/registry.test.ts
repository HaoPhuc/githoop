import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "@/lib/scoring/types";

vi.mock("server-only", () => ({}));

// A small Redis stand-in: sorted sets (desc by score, ties by member desc, like
// ZREVRANGE), one hash, and MULTI that applies its queued commands on exec.
const zsets = new Map<string, Map<string, number>>();
const hash = new Map<string, string>();
const ordered = (key: string) =>
  [...(zsets.get(key) ?? new Map()).entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1)).map(([m]) => m);
const fake = {
  hget: async (_k: string, f: string) => hash.get(f) ?? null,
  hmget: async (_k: string, ...fs: string[]) => fs.map((f) => hash.get(f) ?? null),
  zrevrange: async (k: string, start: number, stop: number) => ordered(k).slice(start, stop + 1),
  zrevrank: async (k: string, m: string) => {
    const i = ordered(k).indexOf(m);
    return i < 0 ? null : i;
  },
  zcard: async (k: string) => zsets.get(k)?.size ?? 0,
  multi() {
    const ops: (() => void)[] = [];
    const tx = {
      hset: (_k: string, f: string, v: string) => (ops.push(() => hash.set(f, v)), tx),
      hdel: (_k: string, f: string) => (ops.push(() => hash.delete(f)), tx),
      zadd: (k: string, s: number, m: string) => (ops.push(() => zsets.set(k, (zsets.get(k) ?? new Map()).set(m, s))), tx),
      zrem: (k: string, m: string) => (ops.push(() => zsets.get(k)?.delete(m)), tx),
      exec: async () => ops.forEach((op) => op()),
    };
    return tx;
  },
};

let useRedis = true;
vi.mock("@/lib/redis", () => ({
  get redis() {
    return useRedis ? fake : null;
  },
}));

const card = (login: string, overall: number, country = "us", extra: Partial<Card> = {}): Card =>
  ({
    login,
    name: login,
    avatarUrl: "",
    overall,
    position: "SG",
    family: "Shooter",
    finish: "gold",
    country,
    topLanguage: "Go",
    stats: { ath: 70, sho: 70, pas: 70, hnd: 70, def: 70, reb: 70 },
    ...extra,
  }) as Card;

beforeEach(() => {
  zsets.clear();
  hash.clear();
  vi.resetModules();
});

describe("registry on Redis", () => {
  const load = async () => {
    useRedis = true;
    return import("@/lib/registry");
  };

  it("ranks recorded cards by overall, worldwide and per country", async () => {
    const r = await load();
    await r.recordCard(card("alice", 80, "fr"));
    await r.recordCard(card("bob", 90, "us"));
    await r.recordCard(card("carol", 85, "fr"));

    const world = await r.topPlayers(0, 10);
    expect(world.map((p) => [p.rank, p.player.login])).toEqual([
      [1, "bob"],
      [2, "carol"],
      [3, "alice"],
    ]);
    expect((await r.topPlayers(0, 10, "FR")).map((p) => p.player.login)).toEqual(["carol", "alice"]);
    expect(await r.playerRank("Alice")).toEqual({ rank: 3, total: 3 });
    expect(await r.playerRank("alice", "fr")).toEqual({ rank: 2, total: 2 });
    expect(await r.playerRank("nobody")).toBeNull();
    expect(await r.countPlayers("us")).toBe(1);
  });

  it("pages with offsets", async () => {
    const r = await load();
    for (let i = 0; i < 5; i++) await r.recordCard(card(`p${i}`, 60 + i));
    expect((await r.topPlayers(2, 2)).map((p) => [p.rank, p.player.login])).toEqual([
      [3, "p2"],
      [4, "p1"],
    ]);
  });

  it("updates a rebuilt card and moves it when its country changes", async () => {
    const r = await load();
    await r.recordCard(card("alice", 70, "fr"));
    await r.recordCard(card("alice", 88, "es"));
    expect((await r.getPlayer("alice"))?.overall).toBe(88);
    expect(await r.countPlayers("fr")).toBe(0);
    expect(await r.playerRank("alice", "es")).toEqual({ rank: 1, total: 1 });
    expect(await r.countPlayers()).toBe(1);
  });

  it("keeps a card's orgs on its entry", async () => {
    const r = await load();
    await r.recordCard(card("alice", 80, "fr", { orgs: ["vercel"] }));
    await r.recordCard(card("bob", 80));
    expect((await r.getPlayer("alice"))?.orgs).toEqual(["vercel"]);
    expect((await r.getPlayer("bob"))?.orgs).toBeUndefined();
  });

  it("takes a player off the board, worldwide and in their country", async () => {
    const r = await load();
    await r.recordCard(card("alice", 80, "fr"));
    await r.recordCard(card("bob", 70, "fr"));
    await r.removePlayer("Alice");
    expect(await r.getPlayer("alice")).toBeNull();
    expect(await r.playerRank("alice")).toBeNull();
    expect(await r.countPlayers("fr")).toBe(1);
    expect(await r.playerRank("bob")).toEqual({ rank: 1, total: 1 });
  });

  it("tells which logins aren't on the board yet, whatever their casing", async () => {
    const r = await load();
    await r.recordCard(card("alice", 80));
    expect(await r.unrecorded(["ALICE", "bob", "carol"])).toEqual(["bob", "carol"]);
    expect(await r.unrecorded([])).toEqual([]);
  });

  it("leaves founder cards out", async () => {
    const r = await load();
    await r.recordCard(card("younesfdj", 93, "dz", { founder: { art: "", accent: "", label: "", tagline: "" } }));
    expect(await r.countPlayers()).toBe(0);
  });
});

describe("registry without Redis", () => {
  const load = async () => {
    useRedis = false;
    return import("@/lib/registry");
  };

  it("serves the sample cards and records new ones in process", async () => {
    const r = await load();
    expect(r.REGISTRY_IS_DEMO).toBe(true);
    const before = await r.countPlayers();
    expect(before).toBeGreaterThan(0);
    await r.recordCard(card("zed", 99, "se"));
    expect((await r.topPlayers(0, 1))[0].player.login).toBe("zed");
    expect(await r.countPlayers()).toBe(before + 1);
    expect(await r.playerRank("zed", "se")).toMatchObject({ rank: 1 });
  });
});
