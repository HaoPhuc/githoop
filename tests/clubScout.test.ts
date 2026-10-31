import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Pins scoutClub's orchestration: squad scouting (top 15, 4 at a time, failures
// skipped), the read-through club cache and its two TTLs, single-flight, and the
// squad time budget. fetchOrg and scoutCard are mocked; the rating itself is
// covered by club.test.ts.
vi.mock("server-only", () => ({}));

const fetchOrg = vi.fn();
vi.mock("@/lib/github/org", () => ({ fetchOrg: (o: string) => fetchOrg(o) }));
const scoutCard = vi.fn();
vi.mock("@/lib/scout", () => ({ scoutCard: (u: string) => scoutCard(u) }));

// In-memory Redis stand-in that also records each key's TTL.
const store = new Map<string, { value: string; ttl: number }>();
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (k: string) => store.get(k)?.value ?? null,
    set: async (k: string, value: string, _ex: string, ttl: number) => {
      store.set(k, { value, ttl });
      return "OK";
    },
  },
}));

import { scoutClub } from "@/lib/club";
import type { OrgPayload } from "@/lib/github/org";

const KEY = "githoop:club:v1:acme";
const SIX_HOURS = 6 * 60 * 60;
const BRIEF = 15 * 60;

const payload = (contributors: number, extra: Partial<OrgPayload> = {}): OrgPayload => ({
  login: "acme",
  name: "Acme",
  avatarUrl: "https://example.com/acme.png",
  description: null,
  location: null,
  createdAt: "2015-01-01T00:00:00Z",
  publicRepos: 3,
  repos: [],
  recentPushes: [],
  contributors: Array.from({ length: contributors }, (_, i) => ({
    login: `p${i + 1}`,
    avatarUrl: "",
    contributions: 100 - i,
    repos: 1,
  })),
  sampledRepos: ["core"],
  contributorsComplete: true,
  ...extra,
});

const card = (login: string) => ({
  login,
  name: login,
  avatarUrl: `https://a/${login}`,
  overall: 70,
  position: "SF",
  finish: "silver",
  stats: { ath: 60, sho: 60, pas: 60, hnd: 60, def: 55, reb: 60 },
});

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  store.clear();
  fetchOrg.mockReset();
  scoutCard.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("scoutClub", () => {
  it("scouts the top fifteen contributors, four at a time, and caches the club for 6 hours", async () => {
    fetchOrg.mockResolvedValue(payload(18));
    let inFlight = 0;
    let peak = 0;
    scoutCard.mockImplementation(async (login: string) => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return card(login);
    });

    const club = await scoutClub("Acme");

    expect(scoutCard.mock.calls.map(([l]) => l)).toEqual(Array.from({ length: 15 }, (_, i) => `p${i + 1}`));
    expect(peak).toBe(4);
    expect(club.squad.size).toBe(5);
    expect(club.squad.bench).toHaveLength(10);
    expect(club.complete).toBe(true);
    expect(Date.parse(club.builtAt ?? "")).not.toBeNaN();
    expect(store.get(KEY)?.ttl).toBe(SIX_HOURS);
  });

  it("serves a cached club without rebuilding, whatever the casing", async () => {
    fetchOrg.mockResolvedValue(payload(2));
    scoutCard.mockImplementation(async (l: string) => card(l));
    await scoutClub("acme");
    await scoutClub("ACME");
    await scoutClub("@acme");
    expect(fetchOrg).toHaveBeenCalledTimes(1);
  });

  it("skips a player whose account is gone and still counts the club complete", async () => {
    fetchOrg.mockResolvedValue(payload(3));
    scoutCard.mockImplementation(async (l: string) => {
      if (l === "p2") throw { type: "notfound", message: "gone" };
      return card(l);
    });
    const club = await scoutClub("acme");
    expect(club.squad.size).toBe(2);
    expect(club.complete).toBe(true);
    expect(store.get(KEY)?.ttl).toBe(SIX_HOURS);
  });

  it("caches only briefly when a scout failed for a reason a retry could fix", async () => {
    fetchOrg.mockResolvedValue(payload(3));
    scoutCard.mockImplementation(async (l: string) => {
      if (l === "p2") throw { type: "ratelimit", message: "limited" };
      return card(l);
    });
    const club = await scoutClub("acme");
    expect(club.squad.size).toBe(2);
    expect(club.complete).toBe(false);
    expect(store.get(KEY)?.ttl).toBe(BRIEF);
  });

  it("caches only briefly when some contributor lists couldn't be read", async () => {
    fetchOrg.mockResolvedValue(payload(2, { contributorsComplete: false }));
    scoutCard.mockImplementation(async (l: string) => card(l));
    expect((await scoutClub("acme")).complete).toBe(false);
    expect(store.get(KEY)?.ttl).toBe(BRIEF);
  });

  it("propagates org errors uncached, so the next visit retries", async () => {
    fetchOrg.mockRejectedValueOnce({ type: "notfound", message: "No GitHub organization by that name." });
    await expect(scoutClub("acme")).rejects.toMatchObject({ type: "notfound" });
    expect(store.size).toBe(0);
    expect(scoutCard).not.toHaveBeenCalled();

    fetchOrg.mockResolvedValueOnce(payload(1));
    scoutCard.mockImplementation(async (l: string) => card(l));
    await expect(scoutClub("acme")).resolves.toMatchObject({ login: "acme" });
    expect(fetchOrg).toHaveBeenCalledTimes(2);
  });

  it("collapses concurrent builds of one org into one", async () => {
    let release!: (p: OrgPayload) => void;
    fetchOrg.mockReturnValueOnce(new Promise<OrgPayload>((r) => (release = r)));
    scoutCard.mockImplementation(async (l: string) => card(l));

    const all = Promise.all([scoutClub("acme"), scoutClub("Acme"), scoutClub("ACME")]);
    await flush();
    release(payload(2));
    const [a, b, c] = await all;
    expect(fetchOrg).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("stops waiting on the squad at the time budget and caches the partial club briefly", async () => {
    vi.useFakeTimers();
    fetchOrg.mockResolvedValue(payload(6));
    // p1 hangs; the other scouts land at once.
    scoutCard.mockImplementation((l: string) => (l === "p1" ? new Promise(() => {}) : Promise.resolve(card(l))));

    const pending = scoutClub("acme");
    await vi.advanceTimersByTimeAsync(6_000);
    const club = await pending;

    expect(club.squad.size).toBe(5);
    expect(club.complete).toBe(false);
    expect(store.get(KEY)?.ttl).toBe(BRIEF);
  });
});
