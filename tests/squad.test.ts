import { describe, expect, it } from "vitest";
import { FORMATION, QUOTA, SQUAD_SIZE, buildSquad, shortName, teamName } from "@/lib/squad";
import type { PlayerEntry } from "@/lib/registry";
import type { Position } from "@/lib/scoring/types";

const player = (login: string, overall: number, position: Position, def = 50): PlayerEntry => ({
  login,
  name: login,
  avatarUrl: "",
  overall,
  position,
  family: "Allrounder",
  finish: "gold",
  country: "fr",
  topLanguage: null,
  stats: { ath: 60, sho: 60, pas: 60, hnd: 60, def, reb: 60 },
});

// n players at one position, overalls counting down from `top`.
const many = (prefix: string, n: number, position: Position, top = 90) =>
  Array.from({ length: n }, (_, i) => player(`${prefix}${i}`, top - i, position));

const logins = (ps: PlayerEntry[]) => ps.map((p) => p.login);

describe("buildSquad", () => {
  const positions: Position[] = ["PG", "SG", "SF", "PF", "C"];

  it("fills a deep pool to 15 players, with three at each position", () => {
    const squad = buildSquad(positions.flatMap((position) => many(position, 6, position)));
    expect(SQUAD_SIZE).toBe(15);
    expect(squad.size).toBe(15);
    for (const position of positions) expect(squad.lines[position]).toHaveLength(QUOTA[position]);
  });

  it("starts exactly five players in their natural basketball positions", () => {
    const squad = buildSquad(positions.flatMap((position) => many(position, 4, position)));
    expect(Object.values(FORMATION).reduce((a, b) => a + b, 0)).toBe(5);
    for (const position of positions) {
      expect(logins(squad.xi[position])).toEqual([`${position}0`]);
      expect(squad.xi[position][0].position).toBe(position);
    }
  });

  it("sorts by overall and keeps registry order on ties", () => {
    const squad = buildSquad([player("a", 70, "PG"), player("b", 95, "PG"), player("c", 95, "PG"), player("d", 60, "PG")]);
    expect(logins(squad.lines.PG)).toEqual(["b", "c", "a"]);
  });

  it("leaves missing positions open instead of moving national players", () => {
    const squad = buildSquad([player("a", 90, "SG"), player("b", 85, "SG"), player("c", 80, "C")]);
    expect(squad.size).toBe(3);
    expect(squad.xi.PG).toEqual([]);
    expect(squad.xi.PF).toEqual([]);
    expect(logins(squad.xi.SG)).toEqual(["a"]);
    expect(logins(squad.xi.C)).toEqual(["c"]);
  });

  it("does not select duplicate logins even when their casing differs", () => {
    const squad = buildSquad([player("player", 90, "PG"), player("PLAYER", 85, "SG")]);
    expect(squad.size).toBe(1);
    expect(logins(squad.lines.PG)).toEqual(["player"]);
  });

  it("ignores unsupported cached positions", () => {
    const squad = buildSquad([player("old-card", 99, "UNKNOWN" as Position)]);
    expect(squad.size).toBe(0);
  });

  it("rates only the starting five, excluding bench players", () => {
    expect(buildSquad([player("a", 90, "SG"), player("b", 60, "SG"), player("c", 85, "C")]).rating).toBe(88);
    expect(buildSquad(many("pg", 4, "PG", 90)).rating).toBe(90);
  });

  it("has no rating or players for an empty pool", () => {
    const squad = buildSquad([]);
    expect(squad.rating).toBeNull();
    expect(squad.size).toBe(0);
  });
});

describe("shortName", () => {
  it("uses the surname of a full name", () => {
    expect(shortName({ name: "Linus Torvalds", login: "torvalds" })).toBe("Torvalds");
  });
  it("keeps a one-word name and drops a parenthetical", () => {
    expect(shortName({ name: "ThePrimeagen", login: "ThePrimeagen" })).toBe("ThePrimeagen");
    expect(shortName({ name: "Theo Browne (t3.gg)", login: "t3dotgg" })).toBe("Browne");
  });
  it("falls back to the login", () => {
    expect(shortName({ name: "  ", login: "octocat" })).toBe("octocat");
  });
});

describe("teamName", () => {
  it("drops the ISO qualifier and uses familiar team names", () => {
    expect(teamName("ir")).toBe("Iran");
    expect(teamName("KR")).toBe("South Korea");
    expect(teamName("cd")).toBe("DR Congo");
    expect(teamName("eng")).toBe("England");
    expect(teamName("us")).toBe("United States");
  });
  it("is null for an unknown code", () => {
    expect(teamName("zz")).toBeNull();
  });
});
