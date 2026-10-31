import type { Finish, Position, Stats } from "../scoring/types";
import { FIT_PENALTY, LINEUPS, positionFit, type Fit, type LineupName, type LineupSlot, type Unit } from "./formations";
import { teamStyle, type TeamStyle } from "./style";

// The shared team engine, part two: five players in a lineup, and what they add
// up to. Every team surface (drafted teams, clubs, national rosters) rates through
// rateTeam, so strength and chemistry mean the same thing everywhere. Pure.

// What a player needs to take a slot. A registry entry and a Card both fit.
export interface TeamPlayer {
  login: string;
  name: string;
  avatarUrl: string;
  overall: number;
  position: Position;
  finish: Finish;
  stats: Stats;
  country: string; // "" when unknown
  topLanguage?: string | null;
  orgs?: string[]; // lowercase; absent on older registry entries
}

// A lineup: one entry per slot of LINEUPS[shape], null for an open slot.
export interface Lineup {
  shape: LineupName;
  players: (TeamPlayer | null)[];
}

export const TEAM = {
  maxChemistry: 15,
  playerChemistry: 3,
  // Players sharing a link (the player included) for 1, 2 and 3 chemistry points.
  links: {
    country: [2, 3, 5],
    language: [2, 4, 5],
    org: [2, 3, 4],
  },
  // A club's players all share its org, which would make every club 15/15, so a
  // club's team counts the org link once.
  clubOrgCap: 1,
  chemistryBonus: 3, // strength points a full 15 chemistry adds
} as const;

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// What a player is worth in a slot, position penalty included.
export function slotRating(p: TeamPlayer, slot: LineupSlot): number {
  return clamp(p.overall - FIT_PENALTY[positionFit(p.position, slot.role)], 1, 99);
}

// ---- auto-picking a lineup ---------------------------------------------------------

// The best five of `candidates` for a lineup: each slot goes to whoever is worth
// most there. With fewer than five, the slots nobody suits stay open.
export function autoLineup(candidates: readonly TeamPlayer[], shape: LineupName): Lineup {
  const slots = LINEUPS[shape];
  const players: (TeamPlayer | null)[] = slots.map(() => null);
  const free = new Set(candidates);

  const offers = slots.flatMap((slot, s) => candidates.map((player) => ({ player, s, value: slotRating(player, slot) })));
  // Ties go to the player with the better card, then the login, so a lineup never
  // depends on the order of its candidates.
  offers.sort(
    (a, b) =>
      b.value - a.value ||
      b.player.overall - a.player.overall ||
      a.player.login.toLowerCase().localeCompare(b.player.login.toLowerCase()) ||
      a.s - b.s,
  );
  for (const { player, s } of offers) {
    if (players[s] === null && free.has(player)) {
      players[s] = player;
      free.delete(player);
    }
  }
  return { shape, players };
}

// ---- rating a lineup ---------------------------------------------------------------

export interface PlacedPlayer {
  slot: LineupSlot;
  player: TeamPlayer | null;
  fit: Fit | null; // null for an open slot
  rating: number | null; // slotRating
  chemistry: number; // 0-3
}

export type UnitRatings = Record<Unit, number | null>;

export interface TeamReport {
  shape: LineupName;
  placed: PlacedPlayer[];
  size: number; // players fielded
  strength: number | null; // the headline number; null with nobody fielded
  units: UnitRatings; // guards, wings and bigs
  chemistry: number; // 0-15
  style: TeamStyle | null;
}

// Points for how many players share a link, on that link's thresholds.
const linkPoints = (count: number, steps: readonly number[]) => steps.filter((n) => count >= n).length;

// Each player's chemistry, 0-3: how many teammates share their country, top
// language and orgs. Only a player in position earns any.
function chemistryOf(placed: { player: TeamPlayer | null; fit: Fit | null }[], orgCap: number): number[] {
  const tally = (keys: (p: TeamPlayer) => string[]) => {
    const counts = new Map<string, number>();
    for (const { player } of placed) {
      if (player) for (const k of new Set(keys(player))) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  };
  const countries = tally((p) => (p.country ? [p.country] : []));
  const languages = tally((p) => (p.topLanguage ? [p.topLanguage] : []));
  const orgs = tally((p) => p.orgs ?? []);

  return placed.map(({ player, fit }) => {
    if (!player || fit === "stretch" || fit === "wrong") return 0;
    const country = linkPoints(countries.get(player.country) ?? 0, TEAM.links.country);
    const language = linkPoints(languages.get(player.topLanguage ?? "") ?? 0, TEAM.links.language);
    const org = Math.max(0, ...(player.orgs ?? []).map((o) => linkPoints(orgs.get(o) ?? 0, TEAM.links.org)));
    return Math.min(TEAM.playerChemistry, country + language + Math.min(org, orgCap));
  });
}

// `club` marks a team drafted from one org (see TEAM.clubOrgCap).
export function rateTeam({ shape, players }: Lineup, { club = false } = {}): TeamReport {
  const slots = LINEUPS[shape];
  const seated = slots.map((slot, i) => {
    const player = players[i] ?? null;
    const fit = player ? positionFit(player.position, slot.role) : null;
    return { slot, player, fit, rating: player ? slotRating(player, slot) : null };
  });
  const chem = chemistryOf(seated, club ? TEAM.clubOrgCap : TEAM.playerChemistry);
  const placed: PlacedPlayer[] = seated.map((s, i) => ({ ...s, chemistry: chem[i] }));

  const ratings = (keep: (slot: LineupSlot) => boolean) =>
    placed.flatMap((p) => (p.rating !== null && keep(p.slot) ? [p.rating] : []));
  const unitRating = (unit: Unit) => {
    const r = ratings((s) => s.unit === unit);
    return r.length ? Math.round(mean(r)) : null;
  };

  const fielded = ratings(() => true);
  const chemistry = chem.reduce((s, x) => s + x, 0);
  return {
    shape,
    placed,
    size: fielded.length,
    strength: fielded.length
      ? clamp(Math.round(mean(fielded) + (TEAM.chemistryBonus * chemistry) / TEAM.maxChemistry), 1, 99)
      : null,
    units: { BACK: unitRating("BACK"), WING: unitRating("WING"), BIG: unitRating("BIG") },
    chemistry,
    style: teamStyle(placed),
  };
}
