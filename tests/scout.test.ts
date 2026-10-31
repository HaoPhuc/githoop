import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These tests pin the single-flight + read-through cache behaviour of scoutCard.
// fetchProfile is the expensive GitHub call we dedupe, so it's mocked and counted;
// signals + engine are pass-throughs here (scoring is covered by engine.test.ts).
vi.mock("server-only", () => ({}));

const fetchProfile = vi.fn();
vi.mock("@/lib/github/client", () => ({ fetchProfile: (u: string) => fetchProfile(u) }));
vi.mock("@/lib/github/signals", () => ({ signalsFromPayload: (p: unknown) => p }));
vi.mock("@/lib/scoring/engine", () => ({ buildCard: (s: unknown) => s }));
vi.mock("@/lib/awards", () => ({
  computeAwards: () => [],
  wcBallCandidate: () => false,
  WC_EDITIONS: [],
})); // Award calculations are covered by awards.test.ts.
vi.mock("@/lib/registry", () => ({ recordCard: async () => {} })); // covered by registry.test.ts
// The merge records, driven per test; lib/merge's own rules are in merge.test.ts.
const mainOf = new Map<string, string>();
const altsByMain = new Map<string, string[]>();
vi.mock("@/lib/merge", () => ({
  mainAccountOf: async (l: string) => mainOf.get(l) ?? l,
  altsOf: async (l: string) => altsByMain.get(l) ?? [],
}));
vi.mock("@/lib/github/combine", () => ({
  combinePayloads: (main: { name: string }, alts: { name: string }[]) =>
    alts.length ? { ...main, name: [main.name, ...alts.map((a) => a.name)].join("+") } : main,
}));

// In-memory Redis stand-in so read-through caching is exercised without a server.
// SET honours NX (the re-scout lock); TTL reports a fixed 600s on held keys.
const store = new Map<string, string>();
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string, ...opts: unknown[]) => {
      if (opts.includes("NX") && store.has(k)) return null;
      store.set(k, v);
      return "OK";
    },
    ttl: async (k: string) => (store.has(k) ? 600 : -2),
    del: async (...keys: string[]) => keys.filter((k) => store.delete(k)).length,
  },
}));

import { dropCards, rescoutCard, scoutCard } from "@/lib/scout";
import type { Card } from "@/lib/scoring/types";

// A promise whose settlement we control, to freeze a fetch mid-flight.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const payload = (login: string) => ({ login, name: login });

beforeEach(() => {
  store.clear();
  mainOf.clear();
  altsByMain.clear();
  fetchProfile.mockReset();
  vi.stubEnv("GITHUB_TOKEN", "test-token"); // skip the tokenless sample fallback
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("merged accounts", () => {
  const merge = () => {
    mainOf.set("alt", "main");
    altsByMain.set("main", ["alt"]);
  };

  it("builds the main card from every account and notes the others", async () => {
    merge();
    fetchProfile.mockImplementation(async (u: string) => payload(u));
    const card = await scoutCard("main");
    expect(fetchProfile.mock.calls.map(([l]) => l)).toEqual(["main", "alt"]);
    expect(card.name).toBe("main+alt");
    expect(card.mergedFrom).toEqual(["alt"]);
  });

  it("answers for the other account with the main card, from the same cache", async () => {
    merge();
    fetchProfile.mockImplementation(async (u: string) => payload(u));
    const viaAlt = await scoutCard("ALT");
    expect(viaAlt.login).toBe("main");
    await scoutCard("main");
    expect(fetchProfile).toHaveBeenCalledTimes(2); // one build across both names
  });

  it("re-scouts the main card when asked for the other account", async () => {
    merge();
    fetchProfile.mockImplementation(async (u: string) => payload(u));
    const res = await rescoutCard("alt");
    expect(res).toMatchObject({ card: { login: "main" } });
    expect(await rescoutCard("main")).toEqual({ retryAfter: 600 }); // one lock for both
  });

  it("stops counting a deleted account", async () => {
    merge();
    fetchProfile.mockImplementation(async (u: string) => {
      if (u === "alt") throw { type: "notfound", message: "gone" };
      return payload(u);
    });
    const card = await scoutCard("main");
    expect(card.name).toBe("main");
    expect(card.mergedFrom).toBeUndefined();
  });

  it("fails the build when another account can't be read", async () => {
    merge();
    fetchProfile.mockImplementation(async (u: string) => {
      if (u === "alt") throw { type: "ratelimit", message: "limited" };
      return payload(u);
    });
    await expect(scoutCard("main")).rejects.toMatchObject({ type: "ratelimit" });
    expect(store.size).toBe(0); // nothing cached without the other account
  });

  it("rebuilds once the cached cards are dropped", async () => {
    fetchProfile.mockImplementation(async (u: string) => payload(u));
    await scoutCard("main");
    await dropCards(["main", "alt"]);
    await scoutCard("main");
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });
});

describe("scoutCard single-flight", () => {
  it("collapses concurrent misses for the same login into one fetch", async () => {
    const d = deferred<ReturnType<typeof payload>>();
    fetchProfile.mockReturnValueOnce(d.promise);

    // Different casings normalise to the same login -> one in-flight build.
    const calls = Promise.all([scoutCard("Torvalds"), scoutCard("torvalds"), scoutCard("TORVALDS")]);
    await flush();
    expect(fetchProfile).toHaveBeenCalledTimes(1);

    const p = payload("torvalds");
    d.resolve(p);
    const [a, b, c] = await calls;
    expect(a).toEqual(p);
    expect(b).toBe(a); // all three share the one built object
    expect(c).toBe(a);
    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("fetches separately for different logins", async () => {
    fetchProfile.mockImplementation(async (u: string) => payload(u));
    await Promise.all([scoutCard("alice"), scoutCard("bob")]);
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it("does not memoise failures — the next scout retries", async () => {
    fetchProfile.mockRejectedValueOnce({ type: "ratelimit", message: "limited" });
    await expect(scoutCard("torvalds")).rejects.toMatchObject({ type: "ratelimit" });
    expect(fetchProfile).toHaveBeenCalledTimes(1);

    // in-flight entry cleared and nothing cached -> a retry hits GitHub again.
    fetchProfile.mockResolvedValueOnce(payload("torvalds"));
    await expect(scoutCard("torvalds")).resolves.toMatchObject({ login: "torvalds" });
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it("serves a cached card without refetching", async () => {
    fetchProfile.mockResolvedValueOnce(payload("torvalds"));
    await scoutCard("torvalds"); // populates the cache
    await scoutCard("torvalds"); // served from cache
    await scoutCard("torvalds");
    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("refetches once the in-flight build has settled (window closed)", async () => {
    fetchProfile.mockResolvedValueOnce(payload("torvalds"));
    await scoutCard("torvalds");
    // Simulate the cache expiring/evicting between scouts.
    store.clear();
    fetchProfile.mockResolvedValueOnce(payload("torvalds"));
    await scoutCard("torvalds");
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it("stamps each fresh build with builtAt", async () => {
    fetchProfile.mockResolvedValueOnce(payload("torvalds"));
    const card = await scoutCard("torvalds");
    expect(Date.parse(card.builtAt ?? "")).not.toBeNaN();
  });
});

describe("rescoutCard", () => {
  const rebuilt = (login: string, name: string) => ({ login, name });

  it("rebuilds past the cache and overwrites it", async () => {
    fetchProfile.mockResolvedValueOnce(rebuilt("torvalds", "old"));
    await scoutCard("torvalds"); // cached

    fetchProfile.mockResolvedValueOnce(rebuilt("torvalds", "new"));
    const res = await rescoutCard("Torvalds");
    expect(res).toMatchObject({ card: { name: "new" } });
    expect(fetchProfile).toHaveBeenCalledTimes(2);

    // The next plain scout serves the rebuilt card from the cache.
    await expect(scoutCard("torvalds")).resolves.toMatchObject({ name: "new" });
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it("allows one re-scout per profile per cooldown", async () => {
    fetchProfile.mockImplementation(async (u: string) => payload(u));
    expect(await rescoutCard("torvalds")).toHaveProperty("card");
    expect(await rescoutCard("TORVALDS")).toEqual({ retryAfter: 600 });
    expect(fetchProfile).toHaveBeenCalledTimes(1);

    // The lock is per login.
    expect(await rescoutCard("alice")).toHaveProperty("card");
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it("keeps the lock after a failed rebuild, so retries can't hammer GitHub", async () => {
    fetchProfile.mockRejectedValueOnce({ type: "ratelimit", message: "limited" });
    await expect(rescoutCard("torvalds")).rejects.toMatchObject({ type: "ratelimit" });
    expect(await rescoutCard("torvalds")).toEqual({ retryAfter: 600 });
    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("returns the sample untouched in the tokenless demo", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const res = (await rescoutCard("torvalds")) as { card: Card };
    expect(res.card.login).toBe("torvalds");
    expect(fetchProfile).not.toHaveBeenCalled();
  });
});
