import { countryFromLocation } from "../geo";
import { rankLanguages, topLanguageLogo, type LanguageLogo } from "../github/languages";
import type { OrgPayload } from "../github/org";
import { LINE_OF, type Line } from "../lines";
import { FINISH_LABELS, K, STATS } from "./constants";
import { rate } from "./engine";
import type { Finish, Position, Stats } from "./types";

// Club mode, the pure half: a GitHub organization rated like a player (six stats
// on the same scale, a tier that reuses the card art) and a squad of its top
// contributors arranged in a formation. lib/club fetches and scouts; this only
// computes, so every rule here is unit-tested without GitHub.

// Each club signal is rated on two anchors like a player's (SIGNAL_REFS): what a
// typical active open-source org has (→ K.stat.typical) and what an elite one has
// (→ 99), log-scaled in between; zero → K.stat.floor.
export const CLUB_REFS = {
  activeRepos: { typical: 3, elite: 100 }, // public repos pushed in the last 90 days (counted up to 100)
  stars: { typical: 500, elite: 1_000_000 }, // stars over the top 100 repos
  topRepoStars: { typical: 200, elite: 200_000 },
  contributors: { typical: 15, elite: 150 }, // humans in the sampled repos' top-30 lists (at most 180)
  languages: { typical: 4, elite: 20 }, // distinct primary languages in the top 100 repos
  forks: { typical: 100, elite: 200_000 }, // forks over the top 100 repos
  publicRepos: { typical: 20, elite: 3_000 }, // public, non-fork
  ageYears: { typical: 5, elite: 15 },
} satisfies Record<string, { typical: number; elite: number }>;

const ACTIVE_DAYS = 90;
const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
const MAIN_LANGUAGES = 5;
const TOP_REPOS = 5;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

// ---- club rating ---------------------------------------------------------------

// The raw counts behind the six club stats, also shown on the club page.
export interface ClubFacts {
  stars: number;
  topRepoStars: number;
  forks: number;
  publicRepos: number;
  activeRepos: number;
  contributors: number;
  languages: number;
  ageYears: number;
}

export function clubFacts(org: OrgPayload, now = new Date()): ClubFacts {
  const since = now.getTime() - ACTIVE_DAYS * DAY_MS;
  const ageYears = Math.max(0, (now.getTime() - Date.parse(org.createdAt)) / YEAR_MS);
  return {
    stars: sum(org.repos.map((r) => r.stars)),
    topRepoStars: Math.max(0, ...org.repos.map((r) => r.stars)),
    forks: sum(org.repos.map((r) => r.forks)),
    publicRepos: org.publicRepos,
    activeRepos: org.recentPushes.filter((t) => Date.parse(t) >= since).length,
    contributors: org.contributors.length,
    languages: new Set(org.repos.flatMap((r) => (r.language ? [r.language] : []))).size,
    ageYears: Math.round(ageYears * 10) / 10,
  };
}

// The basketball reading: ATH is tempo (repos shipping now), SHO is scoring
// (stars), PAS is the passing network (people who commit together), HND is
// technical range (languages), DEF is the code others build on and the club has
// to hold up (forks), REB is the size and years of the squad (repos, age).
export function rateClubStats(f: ClubFacts): Stats {
  const r = CLUB_REFS;
  const o: Stats = {
    ath: rate(f.activeRepos, r.activeRepos),
    sho: 0.7 * rate(f.stars, r.stars) + 0.3 * rate(f.topRepoStars, r.topRepoStars),
    pas: rate(f.contributors, r.contributors),
    hnd: rate(f.languages, r.languages),
    def: rate(f.forks, r.forks),
    reb: 0.7 * rate(f.publicRepos, r.publicRepos) + 0.3 * rate(f.ageYears, r.ageYears),
  };
  for (const k of STATS) o[k] = clamp(Math.round(o[k]), 1, 99);
  return o;
}

// A club tier on the player thresholds, so it wears the same card art. Clubs have
// no legacy score (age already counts in REB) and no in-form spike, so TOTY is
// overall alone and IN-FORM never applies.
export type ClubFinish = Exclude<Finish, "totw" | "founder">;

export function clubFinish(overall: number): ClubFinish {
  const f = K.finish;
  if (overall >= f.iconMin) return "icon";
  if (overall >= f.totyMin) return "toty";
  if (overall >= f.goldMin) return "gold";
  if (overall >= f.silverMin) return "silver";
  return "bronze";
}

// ---- squad + formation -----------------------------------------------------------

export type FormationName = "5v5";
export const FORMATIONS: Record<FormationName, Record<Line, number>> = {
  "5v5": { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 },
};
export const SQUAD_SIZE = 15;
export const STARTING_SIZE = 5;
const POSITIONS: Line[] = ["PG", "SG", "SF", "PF", "C"];

export interface SquadPlayer {
  login: string;
  name: string;
  avatarUrl: string;
  overall: number;
  position: Position;
  finish: Finish;
  def: number;
  contributions: number;
}

export interface SquadSlot {
  player: SquadPlayer | null;
  outOfPosition: boolean;
}

export interface Squad {
  formation: FormationName;
  lines: Record<Line, SquadSlot[]>;
  bench: SquadPlayer[];
  moved: number;
  rating: number | null;
  size: number;
}

const byBest = (a: SquadPlayer, b: SquadPlayer) =>
  b.overall - a.overall ||
  b.contributions - a.contributions ||
  a.login.toLowerCase().localeCompare(b.login.toLowerCase());

// Select natural starters first. When a position is missing, the strongest
// remaining contributor fills the nearest open role; every move is disclosed.
// The remaining roster stays on the bench and is never counted in team OVR.
export function pickSquad(candidates: SquadPlayer[]): Squad {
  const seen = new Set<string>();
  const players = [...candidates].sort(byBest).filter((p) => {
    const login = p.login.toLowerCase();
    if (!LINE_OF[p.position] || seen.has(login)) return false;
    seen.add(login);
    return true;
  }).slice(0, SQUAD_SIZE);
  const lines: Record<Line, SquadSlot[]> = { PG: [], SG: [], SF: [], PF: [], C: [] };
  const picked = new Set<SquadPlayer>();
  for (const position of POSITIONS) {
    const player = players.find((p) => p.position === position);
    if (player) {
      lines[position].push({ player, outOfPosition: false });
      picked.add(player);
    }
  }
  let moved = 0;
  for (const player of players.filter((p) => !picked.has(p))) {
    const open = POSITIONS.filter((p) => !lines[p].length);
    if (!open.length) break;
    const home = POSITIONS.indexOf(player.position);
    const position = open.reduce((a, b) =>
      Math.abs(POSITIONS.indexOf(b) - home) < Math.abs(POSITIONS.indexOf(a) - home) ? b : a);
    lines[position].push({ player, outOfPosition: true });
    picked.add(player);
    moved++;
  }
  for (const position of POSITIONS) {
    if (!lines[position].length) lines[position].push({ player: null, outOfPosition: false });
  }
  const starters = [...picked];
  return {
    formation: "5v5",
    lines,
    bench: players.filter((p) => !picked.has(p)),
    moved,
    rating: starters.length ? Math.round(mean(starters.map((p) => p.overall))) : null,
    size: starters.length,
  };
}

// ---- the club --------------------------------------------------------------------

export interface ClubRepo {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  archived: boolean;
}

export interface ClubLanguage {
  name: string;
  repos: number; // top-100 repos with it as their primary language
}

export interface Club {
  login: string;
  name: string; // the org's display name, else its login
  avatarUrl: string; // the crest
  description: string | null;
  location: string | null;
  country: string; // flag code from the location, "" when unknown
  createdAt: string;
  stats: Stats;
  overall: number;
  finish: ClubFinish;
  finishLabel: string;
  facts: ClubFacts;
  languages: ClubLanguage[]; // main languages, most repos first
  languageLogo: LanguageLogo | null; // the headline language's logo, for the card
  topRepos: ClubRepo[];
  squad: Squad;
  sampledRepos: string[]; // repos the squad was drawn from
  // Set by lib/club: whether every squad scout landed, and when it was built.
  complete?: boolean;
  builtAt?: string;
}

export function buildClub(org: OrgPayload, players: SquadPlayer[], now = new Date()): Club {
  const facts = clubFacts(org, now);
  const stats = rateClubStats(facts);
  const overall = clamp(Math.round(mean(STATS.map((k) => stats[k]))), 1, 99);
  const finish = clubFinish(overall);

  const counts = new Map<string, number>();
  for (const r of org.repos) if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  const ranked = rankLanguages(org.repos);

  return {
    login: org.login,
    name: org.name?.trim() || org.login,
    avatarUrl: org.avatarUrl,
    description: org.description?.trim() || null,
    location: org.location,
    country: countryFromLocation(org.location) ?? "",
    createdAt: org.createdAt,
    stats,
    overall,
    finish,
    finishLabel: FINISH_LABELS[finish],
    facts,
    languages: ranked.slice(0, MAIN_LANGUAGES).map((name) => ({ name, repos: counts.get(name) ?? 0 })),
    languageLogo: topLanguageLogo(ranked),
    topRepos: [...org.repos]
      .sort((a, b) => b.stars - a.stars)
      .slice(0, TOP_REPOS)
      .map(({ name, description, stars, forks, language, archived }) => ({
        name,
        description: description?.trim() || null,
        stars,
        forks,
        language,
        archived,
      })),
    squad: pickSquad(players),
    sampledRepos: org.sampledRepos,
  };
}
