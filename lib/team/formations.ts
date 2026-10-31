import type { Position } from "../scoring/types";

// The shared team engine, part one: lineups as named slots, and how well a card's
// position fits a slot. lib/team/lineup rates a team on top of this. Pure, like
// the scoring engine.

// Where a slot plays: the guards, the wings, or the bigs near the basket.
export type Unit = "BACK" | "WING" | "BIG";

export interface LineupSlot {
  role: Position;
  unit: Unit;
  x: number; // 0 left sideline .. 100 right sideline
  y: number; // 0 half court .. 100 baseline
}

const UNIT_OF: Record<Position, Unit> = { PG: "BACK", SG: "BACK", SF: "WING", PF: "BIG", C: "BIG" };

const slot = (role: Position, x: number, y: number): LineupSlot => ({ role, unit: UNIT_OF[role], x, y });

export const LINEUPS = {
  Traditional: [slot("PG", 50, 30), slot("SG", 82, 46), slot("SF", 18, 46), slot("PF", 68, 80), slot("C", 34, 84)],
  "Small Ball": [slot("PG", 50, 30), slot("SG", 82, 44), slot("SF", 18, 44), slot("SF", 86, 78), slot("PF", 30, 82)],
  "Three Guards": [slot("PG", 50, 30), slot("SG", 82, 44), slot("SG", 18, 44), slot("SF", 84, 78), slot("C", 34, 84)],
  "Five Out": [slot("PG", 50, 30), slot("SG", 84, 42), slot("SG", 16, 42), slot("SF", 90, 76), slot("SF", 10, 76)],
  Jumbo: [slot("PG", 50, 30), slot("SF", 82, 46), slot("SF", 18, 46), slot("PF", 68, 80), slot("C", 34, 84)],
  "Twin Towers": [slot("PG", 34, 32), slot("SG", 72, 42), slot("PF", 50, 62), slot("C", 72, 84), slot("C", 28, 84)],
} satisfies Record<string, LineupSlot[]>;

export type LineupName = keyof typeof LINEUPS;
export const LINEUP_NAMES = Object.keys(LINEUPS) as LineupName[];

// ---- position fit ----------------------------------------------------------------

// natural: their position. close: the next spot along, played nearly as well.
// stretch: two spots away. wrong: the other end of the floor.
export type Fit = "natural" | "close" | "stretch" | "wrong";

// Rating points a player loses by fit.
export const FIT_PENALTY: Record<Fit, number> = { natural: 0, close: 1, stretch: 3, wrong: 7 };

// Positions sit on one ladder from the ball to the basket, so how far apart two
// are is how far a player has to stretch their game.
const LADDER: readonly Position[] = ["PG", "SG", "SF", "PF", "C"];
const FIT_BY_DISTANCE: readonly Fit[] = ["natural", "close", "stretch", "wrong", "wrong"];

export function positionFit(position: Position, role: Position): Fit {
  return FIT_BY_DISTANCE[Math.abs(LADDER.indexOf(position) - LADDER.indexOf(role))];
}
