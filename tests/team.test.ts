import { describe, expect, it } from "vitest";
import { FIT_PENALTY, LINEUP_NAMES, LINEUPS, positionFit, type LineupName } from "@/lib/team/formations";
import { autoLineup, rateTeam, slotRating, TEAM, type Lineup, type TeamPlayer } from "@/lib/team/lineup";
import { teamStyle, TYPICAL_STATS, type TeamStyle } from "@/lib/team/style";
import type { Position, Stats } from "@/lib/scoring/types";

// The shared team engine: lineups, position fit, the auto-picked five, strength,
// chemistry and the team playstyle.

const FLAT: Stats = { ath: 70, sho: 70, pas: 70, hnd: 70, def: 70, reb: 70 };

const player = (login: string, position: Position, overall = 70, extra: Partial<TeamPlayer> = {}): TeamPlayer => ({
  login,
  name: login,
  avatarUrl: "",
  overall,
  position,
  finish: "gold",
  stats: FLAT,
  country: "",
  topLanguage: null,
  ...extra,
});

// A full five of natural fits for a lineup, each slot's role as their position.
const naturalFive = (shape: LineupName, extra: (i: number) => Partial<TeamPlayer> = () => ({})): Lineup => ({
  shape,
  players: LINEUPS[shape].map((slot, i) => player(`p${i}`, slot.role, 70, extra(i))),
});

describe("lineups", () => {
  it("each field five players", () => {
    for (const name of LINEUP_NAMES) expect(LINEUPS[name], name).toHaveLength(5);
  });

  it("match their names, unit by unit", () => {
    const shape = (name: LineupName) => {
      const count = (unit: string) => LINEUPS[name].filter((s) => s.unit === unit).length;
      return [count("BACK"), count("WING"), count("BIG")];
    };
    expect(shape("Traditional")).toEqual([2, 1, 2]);
    expect(shape("Small Ball")).toEqual([2, 2, 1]);
    expect(shape("Three Guards")).toEqual([3, 1, 1]);
    expect(shape("Five Out")).toEqual([3, 2, 0]);
    expect(shape("Jumbo")).toEqual([1, 2, 2]);
    expect(shape("Twin Towers")).toEqual([2, 0, 3]);
  });

  it("lay slots out on the court", () => {
    for (const name of LINEUP_NAMES) {
      for (const s of LINEUPS[name]) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(100);
        expect(s.y).toBeGreaterThan(0);
        expect(s.y).toBeLessThan(100);
      }
    }
  });
});

describe("positionFit", () => {
  it("grades how far apart two positions are", () => {
    expect(positionFit("SF", "SF")).toBe("natural");
    expect(positionFit("PG", "SG")).toBe("close");
    expect(positionFit("C", "PF")).toBe("close");
    expect(positionFit("PG", "SF")).toBe("stretch");
    expect(positionFit("SG", "C")).toBe("wrong");
    expect(positionFit("PG", "C")).toBe("wrong");
  });

  it("reads the same in both directions", () => {
    const all: Position[] = ["PG", "SG", "SF", "PF", "C"];
    for (const a of all) for (const b of all) expect(positionFit(a, b)).toBe(positionFit(b, a));
  });
});

describe("slotRating", () => {
  it("takes the position penalty off the overall", () => {
    const slot = LINEUPS.Traditional.find((s) => s.role === "C")!;
    expect(slotRating(player("a", "C", 80), slot)).toBe(80);
    expect(slotRating(player("a", "PF", 80), slot)).toBe(80 - FIT_PENALTY.close);
    expect(slotRating(player("a", "SF", 80), slot)).toBe(80 - FIT_PENALTY.stretch);
    expect(slotRating(player("a", "PG", 80), slot)).toBe(80 - FIT_PENALTY.wrong);
  });
});

describe("autoLineup", () => {
  const pool = [
    player("g1", "PG", 75),
    player("g2", "SG", 75),
    player("w1", "SF", 75),
    player("b1", "PF", 75),
    player("b2", "C", 75),
    player("spare", "SF", 60),
  ];

  it("fills every slot with the best five", () => {
    const { players } = autoLineup(pool, "Traditional");
    expect(players.every(Boolean)).toBe(true);
    expect(new Set(players).size).toBe(5);
    expect(players).not.toContainEqual(expect.objectContaining({ login: "spare" }));
  });

  it("puts players where they're worth most", () => {
    const report = rateTeam(autoLineup(pool, "Traditional"));
    for (const p of report.placed) expect(p.player?.position).toBe(p.slot.role);
  });

  it("leaves slots open when short of five", () => {
    const { players } = autoLineup(pool.slice(0, 3), "Traditional");
    expect(players.filter(Boolean)).toHaveLength(3);
    expect(players[3]).toBeNull();
  });

  it("doesn't depend on the candidates' order", () => {
    const logins = (l: Lineup) => l.players.map((p) => p?.login);
    expect(logins(autoLineup([...pool].reverse(), "Small Ball"))).toEqual(logins(autoLineup(pool, "Small Ball")));
  });

  it("copes with nobody", () => {
    expect(autoLineup([], "Traditional").players.every((p) => p === null)).toBe(true);
  });
});

describe("rateTeam", () => {
  it("averages what the players are worth in their slots", () => {
    const report = rateTeam(naturalFive("Traditional"));
    expect(report.size).toBe(5);
    expect(report.chemistry).toBe(0);
    expect(report.strength).toBe(70);
  });

  it("rates guards, wings and bigs apart", () => {
    const lineup = naturalFive("Traditional");
    lineup.players[4] = player("big", "C", 90);
    const { units } = rateTeam(lineup);
    expect(units.BACK).toBe(70);
    expect(units.WING).toBe(70);
    expect(units.BIG).toBe(80); // (70 + 90) / 2
  });

  it("lowers strength for players out of position", () => {
    const lineup = naturalFive("Traditional");
    const clean = rateTeam(lineup).strength as number;
    lineup.players = lineup.players.map((p) => (p ? { ...p, position: "C" as const } : p));
    expect(rateTeam(lineup).strength).toBeLessThan(clean);
  });

  it("handles a partial team and an empty one", () => {
    const lineup = naturalFive("Traditional");
    lineup.players = lineup.players.map((p, i) => (i === 1 ? p : null));
    const report = rateTeam(lineup);
    expect(report.size).toBe(1);
    expect(report.strength).toBe(70);
    expect(report.units).toEqual({ BACK: 70, WING: null, BIG: null });
    expect(report.style).toBeNull();

    const empty = rateTeam({ shape: "Traditional", players: [] });
    expect(empty.size).toBe(0);
    expect(empty.strength).toBeNull();
    expect(empty.chemistry).toBe(0);
  });
});

describe("chemistry", () => {
  const withCountry = (n: number) => naturalFive("Traditional", (i) => (i < n ? { country: "vn" } : {}));

  it("counts shared countries on their thresholds", () => {
    expect(rateTeam(withCountry(1)).chemistry).toBe(0);
    expect(rateTeam(withCountry(2)).chemistry).toBe(2 * 1);
    expect(rateTeam(withCountry(3)).chemistry).toBe(3 * 2);
    expect(rateTeam(withCountry(5)).chemistry).toBe(5 * 3);
  });

  it("counts a shared top language", () => {
    const lang = (n: number) => rateTeam(naturalFive("Traditional", (i) => (i < n ? { topLanguage: "Rust" } : {}))).chemistry;
    expect(lang(1)).toBe(0);
    expect(lang(2)).toBe(2);
    expect(lang(4)).toBe(4 * 2);
  });

  it("counts any shared org", () => {
    const report = rateTeam(
      naturalFive("Traditional", (i) => (i === 1 ? { orgs: ["vercel", "acme"] } : i === 2 ? { orgs: ["acme"] } : {})),
    );
    expect(report.placed[1].chemistry).toBe(1);
    expect(report.placed[2].chemistry).toBe(1);
    expect(report.chemistry).toBe(2);
  });

  it("adds links up to three a player, and a full team reaches the maximum", () => {
    const report = rateTeam(naturalFive("Traditional", () => ({ country: "vn", topLanguage: "Go", orgs: ["acme"] })));
    expect(report.placed.every((p) => p.chemistry === 3)).toBe(true);
    expect(report.chemistry).toBe(TEAM.maxChemistry);
    expect(report.strength).toBe(70 + TEAM.chemistryBonus);
  });

  it("gives nothing to a player out of position, but still counts them for others", () => {
    const lineup = withCountry(2);
    lineup.players[1] = { ...lineup.players[1]!, position: "C" }; // a center at shooting guard
    const report = rateTeam(lineup);
    expect(report.placed[1].chemistry).toBe(0);
    expect(report.placed[0].chemistry).toBe(1);
  });

  it("lets a player in the next position along earn it", () => {
    const lineup = withCountry(2);
    lineup.players[1] = { ...lineup.players[1]!, position: "PG" }; // close to shooting guard
    const report = rateTeam(lineup);
    expect(report.placed[0].chemistry).toBe(1);
    expect(report.placed[1].chemistry).toBe(1);
  });

  it("counts a club's own org once, so a club isn't 15/15 by default", () => {
    const club = naturalFive("Traditional", () => ({ orgs: ["acme"] }));
    expect(rateTeam(club).chemistry).toBe(TEAM.maxChemistry);
    expect(rateTeam(club, { club: true }).chemistry).toBe(5);
  });
});

describe("teamStyle", () => {
  const styled = (stats: Partial<Stats>, shape: LineupName = "Traditional") =>
    rateTeam(naturalFive(shape, () => ({ stats: { ...FLAT, ...stats } }))).style as TeamStyle;

  it("reads a passing team as half court, a quick shooting one as fast", () => {
    expect(styled({ pas: 85, hnd: 85, ath: 60, sho: 60, reb: 60 }).pace).toBeLessThan(50);
    expect(styled({ ath: 85, sho: 85, reb: 80, pas: 60, hnd: 60 }).pace).toBeGreaterThan(50);
  });

  it("names all four styles", () => {
    expect(styled({ ath: 71, sho: 70, pas: 80, hnd: 85, def: 56, reb: 90 }).name).toBe("Grind It Out");
    expect(styled({ ath: 60, sho: 85, pas: 85, hnd: 85, def: 80, reb: 70 }, "Twin Towers").name).toBe("Half-Court Sets");
    expect(styled({ ath: 90, sho: 90, pas: 60, hnd: 60, def: 60, reb: 95 }).name).toBe("Full-Court Press");
    expect(styled({ ath: 71, sho: 99, pas: 60, hnd: 60, def: 80, reb: 85 }, "Twin Towers").name).toBe("Run and Gun");
  });

  it("isn't changed by how strong a team is, only by its shape", () => {
    const level = (n: number) => styled({ ath: n, sho: n, pas: n, hnd: n, def: n, reb: n });
    expect(level(90).tendencies).toEqual(level(55).tendencies);
  });

  it("spaces the floor with more shooters outside the paint", () => {
    expect(styled({}, "Five Out").tendencies.spacing).toBeGreaterThan(styled({}).tendencies.spacing);
    expect(styled({}).tendencies.spacing).toBeGreaterThan(styled({}, "Twin Towers").tendencies.spacing);
  });

  it("sits a typical team in the middle of both axes", () => {
    const typical = styled(TYPICAL_STATS);
    expect(typical.tendencies.tempo).toBe(50);
    expect(typical.tendencies.offense).toBe(50);
    expect(typical.tendencies.pressure).toBe(50);
    expect(typical.tendencies.coverage).toBe(50);
  });

  it("drops the coverage with more bigs", () => {
    expect(styled({}, "Small Ball").tendencies.coverage).toBeGreaterThan(styled({}).tendencies.coverage);
    expect(styled({}).tendencies.coverage).toBeGreaterThan(styled({}, "Twin Towers").tendencies.coverage);
  });

  it("copes with a lineup that has no bigs", () => {
    expect(styled({}, "Five Out").tendencies.coverage).toBeGreaterThan(styled({}, "Small Ball").tendencies.coverage);
  });

  it("keeps tendencies on the 0-100 scale", () => {
    const extreme = styled({ ath: 99, sho: 99, reb: 99, pas: 1, hnd: 1, def: 1 });
    for (const v of Object.values(extreme.tendencies)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("needs a few players", () => {
    expect(teamStyle(rateTeam({ shape: "Traditional", players: [] }).placed)).toBeNull();
  });
});
