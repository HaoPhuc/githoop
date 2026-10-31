import type { Family, Finish, FounderMeta, StatKey, Stats } from "./types";

export const STATS: StatKey[] = ["ath", "sho", "pas", "hnd", "def", "reb"];

// Canonical stat → display abbreviation: the single source for any surface that
// labels the six stats (the Duel's shootout rows read these).
export const STAT_LABELS: Record<StatKey, string> = {
  ath: "ATH",
  sho: "SHO",
  pas: "PAS",
  hnd: "HND",
  def: "DEF",
  reb: "REB",
};

// Each GitHub count is rated on two anchors: what a typical active developer has
// (→ K.stat.typical) and what an elite one has (→ 99), log-scaled in between; zero
// → K.stat.floor. The card shows these ratings as-is, so moving an anchor here
// moves that stat on every card.
export const SIGNAL_REFS = {
  recentContributions: { typical: 400, elite: 5_000 },
  stars: { typical: 30, elite: 200_000 },
  topRepoStars: { typical: 15, elite: 150_000 },
  prs: { typical: 30, elite: 2_000 },
  followers: { typical: 30, elite: 100_000 },
  languages: { typical: 5, elite: 20 },
  reviewsAndIssues: { typical: 30, elite: 3_000 },
  lifetimeContributions: { typical: 2_000, elite: 50_000 },
  activeYears: { typical: 4, elite: 12 },
} satisfies Record<string, { typical: number; elite: number }>;

export const K = {
  stat: { floor: 40, typical: 60 },
  position: {
    // Below this average stat there's too little activity to read a shape from.
    thinMean: 50,
    // Points above the player's own average an archetype's HIGH stats need.
    standOut: 5,
  },
  legacy: { a: 1.0, b: 0.7, c: 0.3, d: 0.3, e: 0.3, f: 6.0, activeCap: 15, bonusMax: 11 },
  ovrCap: 88,
  finish: { iconMin: 90, totyMin: 85, totyLegacy: 0.5, goldMin: 75, silverMin: 65 },
  iconAllowlist: [] as string[],
  outlook: {
    // Player age = startAge + years on GitHub; growth room shrinks by
    // roomPerYear until peakAge, capped at maxRoom.
    startAge: 17,
    peakAge: 29,
    roomPerYear: 1.5,
    maxRoom: 15,
    // Coding on dailyDays of the last year keeps all of the room; never coding
    // keeps baseDrive of it.
    dailyDays: 250,
    baseDrive: 0.25,
    // Value: an S-curve on overall that levels off at valueMax (≈ €230K at 60,
    // €2.7M at 70, €30M at 80, €155M at 90), × e^perPotential per point of
    // headroom; past declineFrom it loses declinePerYear a year, down to
    // valueFloor of itself.
    valueMax: 250_000_000,
    valueMid: 88,
    valueSteep: 0.25,
    perPotential: 0.1,
    declineFrom: 30,
    declinePerYear: 0.06,
    valueFloor: 0.4,
  },
};

// The archetype tree. An archetype fits when every HIGH stat stands out above the
// player's own average (by K.position.standOut) and every LOW stat sits below it;
// if several fit, the strongest HIGH-vs-LOW contrast wins. None fitting (or too
// thin a profile) makes an Allrounder.
export const ARCHETYPES: { family: Exclude<Family, "Allrounder">; high: StatKey[]; low: StatKey[] }[] = [
  { family: "Playmaker", high: ["hnd", "pas"], low: ["def", "reb"] },
  { family: "Shooter", high: ["sho"], low: ["def"] },
  { family: "RimProtector", high: ["def", "reb"], low: ["sho"] },
  { family: "Slasher", high: ["ath"], low: ["sho"] },
];

export const WEIGHTS: Record<Family, Stats> = {
  Shooter: { ath: 0.2, sho: 0.3, pas: 0.1, hnd: 0.2, def: 0.05, reb: 0.15 },
  Playmaker: { ath: 0.1, sho: 0.15, pas: 0.3, hnd: 0.25, def: 0.1, reb: 0.1 },
  RimProtector: { ath: 0.1, sho: 0.05, pas: 0.15, hnd: 0.1, def: 0.4, reb: 0.2 },
  Slasher: { ath: 0.3, sho: 0.05, pas: 0.15, hnd: 0.1, def: 0.2, reb: 0.2 },
  Allrounder: { ath: 1 / 6, sho: 1 / 6, pas: 1 / 6, hnd: 1 / 6, def: 1 / 6, reb: 1 / 6 },
};

export const FINISH_LABELS: Record<Finish, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  totw: "HOT STREAK",
  toty: "ALL-STAR",
  icon: "HALL OF FAME",
  founder: "FOUNDER",
};

// Reserved for explicitly configured commemorative treatments. No upstream
// founder privileges carry into GitHoop: every profile is scored on its signals.
export const FOUNDERS: Record<string, FounderMeta> = {};

// Optional ratings paired with the commemorative treatments above.
export const FOUNDER_OVERALL: Record<string, number> = {};
