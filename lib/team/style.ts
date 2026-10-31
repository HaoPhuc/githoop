import type { StatKey, Stats } from "../scoring/types";
import type { PlacedPlayer, TeamPlayer } from "./lineup";

// The shared team engine, part three: how a team plays. Five tendencies on a
// 0-100 scale, read from the players' stats and the shape of the lineup, roll up
// into two axes (half court or fast break, contain or press) and so into one of
// four styles. GitHub has no game data, so this reads what a team is built to do,
// not what it did.
//
// Tendencies weigh one set of stats against another, the same idea as the card
// archetypes: a stronger team isn't faster or more aggressive just for being
// stronger. Each stat counts from a typical starter's (TYPICAL_STATS), because the
// raw scales differ: real cards run far higher on SHO than on DEF, so raw gaps
// would make every team a shooting team.

export type TendencyKey = "tempo" | "spacing" | "offense" | "pressure" | "coverage";
export type Tendencies = Record<TendencyKey, number>;

// The two ends of each tendency, 0 then 100, for the UI.
export const TENDENCY_ENDS: Record<TendencyKey, { label: string; low: string; high: string }> = {
  tempo: { label: "Tempo", low: "Half court", high: "Fast break" },
  spacing: { label: "Spacing", low: "Paint", high: "Perimeter" },
  offense: { label: "Offense", low: "Ball movement", high: "Shot making" },
  pressure: { label: "Pressure", low: "Contain", high: "Press" },
  coverage: { label: "Coverage", low: "Drop", high: "Switch" },
};

export type StyleName = "Full-Court Press" | "Run and Gun" | "Grind It Out" | "Half-Court Sets";

export interface TeamStyle {
  name: StyleName;
  blurb: string;
  tendencies: Tendencies;
  pace: number; // 0 half court .. 100 fast break
  pressing: number; // 0 contain .. 100 press
}

const BLURBS: Record<StyleName, string> = {
  "Full-Court Press": "pushes the pace and pressures the ball end to end",
  "Run and Gun": "gets up the floor early and lets it fly",
  "Grind It Out": "slows the game down and fights for every stop",
  "Half-Court Sets": "runs its offense through sets and stays home on defense",
};

export const STYLE_AT = {
  minPlayers: 3, // fewer players than this don't make a style
  neutral: 50,
  statScale: 2.5, // tendency points per stat point of lean
  typicalPerimeter: 0.6, // share of slots a traditional lineup plays outside the paint
  spacingPerShare: 100, // spacing points per share of slots above that
  typicalBigs: 2,
  coveragePerBig: 12, // coverage points per big fewer than a traditional lineup
} as const;

// Mean stats of the starters who make an auto-picked team, carried over from
// gitfutbol's measurement (89 real cards, Oct 2026): GitHoop rates each stat from
// the same signals on the same anchors, so its pac/dri/phy are ath/hnd/reb here.
// Re-measure on GitHoop's own registry as it grows: a change here shifts every team.
export const TYPICAL_STATS: Stats = { ath: 71, sho: 85, pas: 70, hnd: 70, def: 56, reb: 82 };

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const average = (players: TeamPlayer[], keys: StatKey[]) => mean(players.flatMap((p) => keys.map((k) => p.stats[k])));

// A group's lean toward `high` stats over `low` ones, each from its typical value.
const aboveTypical = (players: TeamPlayer[], keys: StatKey[]) =>
  average(players, keys) - mean(keys.map((k) => TYPICAL_STATS[k]));
const lean = (players: TeamPlayer[], high: StatKey[], low: StatKey[]) =>
  players.length
    ? STYLE_AT.neutral + STYLE_AT.statScale * (aboveTypical(players, high) - aboveTypical(players, low))
    : STYLE_AT.neutral;

export function teamStyle(placed: PlacedPlayer[]): TeamStyle | null {
  const floor = placed.flatMap(({ slot, player }) => (player ? [{ slot, player }] : []));
  if (floor.length < STYLE_AT.minPlayers) return null;

  const everyone = floor.map((f) => f.player);
  const perimeter = floor.filter(({ slot }) => slot.unit !== "BIG").map((f) => f.player);
  const bigs = floor.filter(({ slot }) => slot.unit === "BIG").map((f) => f.player);

  // The lineup sets most of the spacing, then shooters on the outside stretch it.
  const spacing =
    STYLE_AT.neutral +
    STYLE_AT.spacingPerShare * (perimeter.length / floor.length - STYLE_AT.typicalPerimeter) +
    (perimeter.length ? STYLE_AT.statScale * (average(perimeter, ["sho"]) - average(everyone, ["sho"])) : 0);

  // Twin towers drop back to protect the rim whoever plays there; quick bigs can
  // switch onto the perimeter where slow, strong ones can't.
  const bigSlots = placed.filter(({ slot }) => slot.unit === "BIG").length;
  const coverage = lean(bigs, ["ath"], ["def"]) + STYLE_AT.coveragePerBig * (STYLE_AT.typicalBigs - bigSlots);

  const tendencies: Tendencies = {
    tempo: clamp(lean(perimeter, ["ath", "reb"], ["pas", "hnd"])),
    spacing: clamp(spacing),
    offense: clamp(lean(perimeter, ["sho", "ath"], ["pas", "hnd"])),
    pressure: clamp(lean(perimeter, ["ath", "reb", "def"], ["sho", "pas"])),
    coverage: clamp(coverage),
  };

  const pace = clamp(mean([tendencies.tempo, tendencies.offense]));
  const pressing = clamp(mean([tendencies.pressure, tendencies.coverage]));
  const fast = pace >= STYLE_AT.neutral;
  const press = pressing >= STYLE_AT.neutral;
  const name: StyleName = fast ? (press ? "Full-Court Press" : "Run and Gun") : press ? "Grind It Out" : "Half-Court Sets";
  return { name, blurb: BLURBS[name], tendencies, pace, pressing };
}
