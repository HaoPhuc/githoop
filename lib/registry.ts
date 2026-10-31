import "server-only";
import { redis } from "./redis";
import { SAMPLE_CARDS } from "./github/samples";
import type { Card, Family, Finish, Position, Stats } from "./scoring/types";

// The player registry: every card built from GitHub, ranked by overall. It backs
// the leaderboard and the national squads. Each fresh build (lib/scout) records
// the card; entries never expire, a rebuild just updates them.
//
// Redis: one sorted set for the world, one per country, and a hash of compact
// entries. Without Redis there is no shared store, so an in-process registry
// stands in, seeded with the sample cards: enough for the tokenless demo and
// local development, but per server instance (REGISTRY_IS_DEMO tells the UI).
//
// Founder cards are left out: their overall is forced, not earned.

export interface PlayerEntry {
  login: string;
  name: string;
  avatarUrl: string;
  overall: number;
  position: Position;
  family: Family;
  finish: Finish;
  country: string; // GitHub-derived (never the flag-picker override); "" when unknown
  topLanguage: string | null;
  stats: Stats;
  builtAt?: string;
}

export interface RankedPlayer {
  rank: number; // 1-based, within the queried scope (world or one country)
  player: PlayerEntry;
}

const V = "v1";
const WORLD = `githoop:rank:${V}`;
const countryKey = (cc: string) => `githoop:rank:${V}:cc:${cc}`;
const ENTRIES = `githoop:players:${V}`;

export const REGISTRY_IS_DEMO = !redis;

const toEntry = (card: Card): PlayerEntry => ({
  login: card.login,
  name: card.name,
  avatarUrl: card.avatarUrl,
  overall: card.overall,
  position: card.position,
  family: card.family,
  finish: card.finish,
  country: card.country,
  topLanguage: card.topLanguage ?? null,
  stats: card.stats,
  ...(card.builtAt ? { builtAt: card.builtAt } : null),
});

const idOf = (login: string) => login.toLowerCase();
const scopeKey = (country?: string) => (country ? countryKey(country.toLowerCase()) : WORLD);

// ---- in-process fallback -----------------------------------------------------

let memory: Map<string, PlayerEntry> | null = null;
function memoryStore(): Map<string, PlayerEntry> {
  if (!memory) {
    memory = new Map();
    for (const c of SAMPLE_CARDS) if (!c.founder) memory.set(idOf(c.login), toEntry(c));
  }
  return memory;
}
// Same order as the Redis sorted sets: overall desc, ties by login desc.
const byRank = (a: PlayerEntry, b: PlayerEntry) =>
  b.overall - a.overall || (idOf(a.login) < idOf(b.login) ? 1 : idOf(a.login) > idOf(b.login) ? -1 : 0);
const memoryScope = (country?: string) =>
  [...memoryStore().values()].filter((p) => !country || p.country === country.toLowerCase()).sort(byRank);

// ---- writes --------------------------------------------------------------------

// Best-effort, like the card cache: a failure is logged, never thrown.
export async function recordCard(card: Card): Promise<void> {
  if (card.founder) return;
  const entry = toEntry(card);
  const id = idOf(card.login);
  if (!redis) {
    memoryStore().set(id, entry);
    return;
  }
  try {
    const previous = await redis.hget(ENTRIES, id);
    const oldCountry = previous ? (JSON.parse(previous) as PlayerEntry).country : "";
    const tx = redis.multi().hset(ENTRIES, id, JSON.stringify(entry)).zadd(WORLD, entry.overall, id);
    if (oldCountry && oldCountry !== entry.country) tx.zrem(countryKey(oldCountry), id);
    if (entry.country) tx.zadd(countryKey(entry.country), entry.overall, id);
    await tx.exec();
  } catch (e) {
    console.error("[registry] record failed:", (e as Error).message);
  }
}

// ---- reads ---------------------------------------------------------------------
// Each returns the empty answer (not an error) if Redis fails mid-request.

// Players ranked offset+1 .. offset+limit, in the world or one country.
export async function topPlayers(offset: number, limit: number, country?: string): Promise<RankedPlayer[]> {
  if (!redis) {
    return memoryScope(country)
      .slice(offset, offset + limit)
      .map((player, i) => ({ rank: offset + i + 1, player }));
  }
  try {
    const ids = await redis.zrevrange(scopeKey(country), offset, offset + limit - 1);
    if (!ids.length) return [];
    const raw = await redis.hmget(ENTRIES, ...ids);
    return raw.flatMap((json, i) => (json ? [{ rank: offset + i + 1, player: JSON.parse(json) as PlayerEntry }] : []));
  } catch (e) {
    console.error("[registry] read failed:", (e as Error).message);
    return [];
  }
}

// A player's 1-based rank and the scope's size, or null if they aren't ranked.
export async function playerRank(login: string, country?: string): Promise<{ rank: number; total: number } | null> {
  const id = idOf(login);
  if (!redis) {
    const scope = memoryScope(country);
    const i = scope.findIndex((p) => idOf(p.login) === id);
    return i < 0 ? null : { rank: i + 1, total: scope.length };
  }
  try {
    const [rank, total] = await Promise.all([redis.zrevrank(scopeKey(country), id), redis.zcard(scopeKey(country))]);
    return rank === null ? null : { rank: rank + 1, total };
  } catch (e) {
    console.error("[registry] read failed:", (e as Error).message);
    return null;
  }
}

export async function countPlayers(country?: string): Promise<number> {
  if (!redis) return memoryScope(country).length;
  try {
    return await redis.zcard(scopeKey(country));
  } catch (e) {
    console.error("[registry] read failed:", (e as Error).message);
    return 0;
  }
}

// One player's entry, or null if they've never been scouted.
export async function getPlayer(login: string): Promise<PlayerEntry | null> {
  const id = idOf(login);
  if (!redis) return memoryStore().get(id) ?? null;
  try {
    const json = await redis.hget(ENTRIES, id);
    return json ? (JSON.parse(json) as PlayerEntry) : null;
  } catch (e) {
    console.error("[registry] read failed:", (e as Error).message);
    return null;
  }
}
