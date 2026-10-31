import type { Position } from "./scoring/types";

// Every basketball roster uses the same five natural positions.
export type Line = Position;
export type OutfieldLine = Line;

export const LINE_OF: Record<Position, Line> = { PG: "PG", SG: "SG", SF: "SF", PF: "PF", C: "C" };

export const POSITION_NAMES: Record<Line, string> = {
  PG: "Point guards", SG: "Shooting guards", SF: "Small forwards", PF: "Power forwards", C: "Centers",
};
