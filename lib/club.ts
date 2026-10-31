import "server-only";
import { cache } from "react";
import { redis } from "./redis";
import type { GithubError, GithubErrorType } from "./github/client";
import { fetchOrg, type OrgContributor } from "./github/org";
import { scoutCard } from "./scout";
import { buildClub, SQUAD_SIZE, type Club, type SquadPlayer } from "./scoring/club";
import type { Card } from "./scoring/types";

// Org → Club, Redis-cached: the single path the /club/<org> page uses. A build is
// one org query, a few REST contributor lists and up to fifteen player scouts, so
// it's cached for hours, and concurrent builds of one org share a single flight,
// mirroring lib/scout.
//
// Best-effort like the card cache: no REDIS_URL, a miss, an outage or a parse
// error all fall through to a live build. Org errors (notfound / ratelimit / …)
// propagate and are never cached. A build missing players for a reason a retry
// could fix (rate limit, timeout) is cached only briefly, so the squad fills in
// on a later visit from the player cards scouted meanwhile.

const CACHE_VERSION = "v1"; // bump when Club's shape or the club rating changes
const CLUB_TTL_SECONDS = 6 * 60 * 60;
const PARTIAL_TTL_SECONDS = 15 * 60;
// Squad scouts in flight at once: enough to finish fifteen cold scouts in a few
// rounds without one club spending a burst of the token pool.
const SCOUT_CONCURRENCY = 4;
// Stop waiting on the squad after this long, so the page answers inside a
// serverless function's ~10s cap. A late scout still finishes into the card
// cache; the next build picks it up.
const SQUAD_BUDGET_MS = 6_000;
// Scout errors a retry won't fix: the squad is as complete as it will get.
const FINAL_ERRORS = new Set<GithubErrorType>(["notfound", "invalid"]);

const normalizeLogin = (org: string) => org.trim().replace(/^@/, "").toLowerCase();
const keyFor = (org: string) => `githoop:club:${CACHE_VERSION}:${org}`;

async function readCache(org: string): Promise<Club | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(keyFor(org));
    return raw ? (JSON.parse(raw) as Club) : null;
  } catch (e) {
    console.error("[club] cache read failed:", (e as Error).message);
    return null;
  }
}

async function writeCache(org: string, club: Club, ttl: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(keyFor(org), JSON.stringify(club), "EX", ttl);
  } catch (e) {
    console.error("[club] cache write failed:", (e as Error).message);
  }
}

const toPlayer = (card: Card, c: OrgContributor): SquadPlayer => ({
  login: card.login,
  name: card.name,
  avatarUrl: card.avatarUrl,
  overall: card.overall,
  position: card.position,
  finish: card.finish,
  def: card.stats.def,
  contributions: c.contributions,
});

// The top contributors scouted as players (scoutCard: Redis-cached, single-flight),
// SCOUT_CONCURRENCY at a time. A failed scout is skipped; `complete` is false when
// a skip was transient or the budget ran out.
async function scoutSquad(contributors: OrgContributor[]): Promise<{ players: SquadPlayer[]; complete: boolean }> {
  const picks = contributors.slice(0, SQUAD_SIZE);
  const players: (SquadPlayer | null)[] = picks.map(() => null);
  let complete = true;
  let next = 0;
  let late = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      late = true;
      resolve(null);
    }, SQUAD_BUDGET_MS);
  });

  const worker = async () => {
    while (next < picks.length && !late) {
      const i = next++;
      try {
        const card = await Promise.race([scoutCard(picks[i].login), deadline]);
        if (!card) return; // still scouting at the deadline
        players[i] = toPlayer(card, picks[i]);
      } catch (e) {
        if (!FINAL_ERRORS.has((e as GithubError).type)) complete = false;
      }
    }
  };
  await Promise.all(Array.from({ length: SCOUT_CONCURRENCY }, worker));
  clearTimeout(timer);
  if (late) complete = false;
  return { players: players.filter((p): p is SquadPlayer => p !== null), complete };
}

async function buildFresh(org: string, login: string): Promise<Club> {
  const payload = await fetchOrg(org);
  const { players, complete } = await scoutSquad(payload.contributors);
  const club: Club = {
    ...buildClub(payload, players),
    complete: complete && payload.contributorsComplete,
    builtAt: new Date().toISOString(),
  };
  await writeCache(login, club, club.complete ? CLUB_TTL_SECONDS : PARTIAL_TTL_SECONDS);
  return club;
}

// Concurrent builds of one org collapse onto one in-flight build, deleted once it
// settles (so failures are never memoised), exactly like lib/scout's `inflight`.
const inflight = new Map<string, Promise<Club>>();

// Org login -> Club, Redis-cached. Throws the GithubError from fetchOrg when the
// org can't be read.
export async function scoutClub(org: string): Promise<Club> {
  const login = normalizeLogin(org);
  const cached = await readCache(login);
  if (cached) return cached;
  const existing = inflight.get(login);
  if (existing) return existing;
  const pending = buildFresh(org, login).finally(() => inflight.delete(login));
  inflight.set(login, pending);
  return pending;
}

// Request-memoised, error-returning load, so the page's generateMetadata and Page
// share one build per request (like lib/scout's loadCard).
export const loadClub = cache(async (org: string): Promise<{ club: Club } | { error: GithubError }> => {
  try {
    return { club: await scoutClub(org) };
  } catch (e) {
    return { error: e as GithubError };
  }
});
