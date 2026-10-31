import { countryName } from "./countries";
import { LINE_OF, type Line } from "./lines";
import type { PlayerEntry } from "./registry";

// National rosters take three players at each basketball position. The best
// player at each position starts; a short pool leaves that position open.

/** Display order, back to front. */
export const LINES: readonly Line[] = ["PG", "SG", "SF", "PF", "C"];

/** Three players per position: a fifteen-player roster. */
export const QUOTA: Record<Line, number> = { PG: 3, SG: 3, SF: 3, PF: 3, C: 3 };

/** One starter at each position. */
export const FORMATION: Record<Line, number> = { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 };

export const SQUAD_SIZE = LINES.reduce((n, l) => n + QUOTA[l], 0);

export interface Squad {
  /** Each position best-first by overall. */
  lines: Record<Line, PlayerEntry[]>;
  /** The starting five by position. The legacy property name is kept internally. */
  xi: Record<Line, PlayerEntry[]>;
  /** Rounded average overall of the starters, or null with nobody to field. */
  rating: number | null;
  /** Players called up, at most SQUAD_SIZE. */
  size: number;
}

const emptyLines = (): Record<Line, PlayerEntry[]> => ({ PG: [], SG: [], SF: [], PF: [], C: [] });

export function buildSquad(pool: readonly PlayerEntry[]): Squad {
  // Array sort is stable, so equal overalls keep the registry's order.
  const ranked = [...pool].sort((a, b) => b.overall - a.overall);
  const lines = emptyLines();
  const picked = new Set<string>();
  for (const p of ranked) {
    const line = LINE_OF[p.position];
    // An entry from a position the engine no longer emits has no line.
    if (line && !picked.has(p.login.toLowerCase()) && lines[line].length < QUOTA[line]) {
      lines[line].push(p);
      picked.add(p.login.toLowerCase());
    }
  }
  const xi = emptyLines();
  for (const l of LINES) xi[l] = lines[l].slice(0, FORMATION[l]);
  const starters = LINES.flatMap((l) => xi[l]);
  return {
    lines,
    xi,
    rating: starters.length ? Math.round(starters.reduce((s, p) => s + p.overall, 0) / starters.length) : null,
    size: LINES.reduce((n, l) => n + lines[l].length, 0),
  };
}

// The name on a court chip: the surname ("Linus Torvalds" ->
// "Torvalds"). One-word names stay whole; no name falls back to the login.
export function shortName(p: Pick<PlayerEntry, "name" | "login">): string {
  const words = p.name.replace(/\(.*?\)/g, " ").trim().split(/\s+/).filter(Boolean);
  return words.at(-1) ?? p.login;
}

// What the team is called on the squad pages. The country list keeps ISO names
// ("Korea, Republic of"), which read badly on a team sheet: a few get their
// familiar team name, the rest just drop the ", ..." qualifier.
const TEAM_NAMES: Record<string, string> = {
  kr: "South Korea",
  kp: "North Korea",
  cd: "DR Congo",
  vg: "British Virgin Islands",
  vi: "US Virgin Islands",
};

export function teamName(code: string): string | null {
  const name = countryName(code);
  if (!name) return null;
  return TEAM_NAMES[code.toLowerCase()] ?? name.split(", ")[0];
}
