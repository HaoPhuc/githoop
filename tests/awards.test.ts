import { describe, expect, it } from "vitest";
import {
  computeAwards,
  groupAwards,
  wcBallCandidate,
  yearScore,
  type WcWindowTotals,
} from "@/lib/awards";
import type { Card, YearBreakdown } from "@/lib/scoring/types";

// The awards engine is pure card+years -> instances; these lock the gates, the
// log physics, the self-relative MVP selector and the era-adjusted
// World Cup rules.

const year = (y: number, over: Partial<YearBreakdown> = {}): YearBreakdown => ({
  year: y,
  commits: 0,
  prs: 0,
  reviews: 0,
  issues: 0,
  restricted: 0,
  ...over,
});

const card = (over: Partial<Card> = {}): Card =>
  ({
    overall: 85,
    finish: "gold",
    position: "SF",
    country: "",
    stats: { ath: 70, sho: 70, pas: 70, hnd: 70, def: 70, reb: 70 },
    years: [],
    ...over,
  }) as Card;

const keys = (c: Card, wc: WcWindowTotals[] = []) => computeAwards(c, wc).map((a) => a.key);

describe("yearScore log physics", () => {
  it("dampens volume: 10× the commits is nowhere near 10× the score", () => {
    const small = yearScore(year(2020, { commits: 2000 }));
    const spam = yearScore(year(2020, { commits: 20000 }));
    expect(spam).toBeGreaterThan(small);
    expect(spam / small).toBeLessThan(1.4);
  });

  it("rewards breadth: spread beats the same raw total on one axis", () => {
    const spread = yearScore(year(2020, { commits: 800, prs: 80, reviews: 80, issues: 40 }));
    const single = yearScore(year(2020, { commits: 1000 }));
    expect(spread).toBeGreaterThan(single);
  });
});

describe("MVP", () => {
  // A career: quiet years around one towering year — the breakout-season shape.
  const spikeYears = [
    year(2019, { commits: 300, issues: 10 }),
    year(2020, { commits: 350, issues: 12 }),
    year(2021, { commits: 4000, prs: 300, reviews: 400, issues: 150 }),
    year(2022, { commits: 320, issues: 9 }),
  ];

  it("awards the spike year, attached to that year, with a reason naming rank and fronts", () => {
    const got = computeAwards(card({ years: spikeYears })).filter((a) => a.key === "ballon_dor");
    expect(got).toHaveLength(1);
    expect(got[0].year).toBe(2021);
    expect(got[0].reason).toContain("× the career-median season");
    expect(got[0].reason).toContain("spread over commits, PRs, reviews and issues");
  });

  it("stays prestigious: a spiky but small year (under 2k contributions) wins nothing", () => {
    // The mawsis case: real breadth, real spike, modest volume.
    const modest = [
      year(2023, { commits: 150, issues: 20 }),
      year(2024, { commits: 300, prs: 60, issues: 48 }),
      year(2025, { commits: 200, issues: 15 }),
      year(2026, { commits: 600, prs: 200, reviews: 80, issues: 39 }),
    ];
    expect(keys(card({ years: modest }))).not.toContain("ballon_dor");
  });

  it("gates on overall rating", () => {
    expect(keys(card({ years: spikeYears, overall: 79 }))).not.toContain("ballon_dor");
  });

  it("gives a flat career nothing — even a spammer's flat 20k-commit career", () => {
    const flat = [2019, 2020, 2021, 2022].map((y) => year(y, { commits: 20000 }));
    expect(keys(card({ years: flat }))).not.toContain("ballon_dor");
  });

  // Escalating career: later years tower over the early median, every one of
  // them a qualifying monster — the pool for the cap and repeat-ladder tests.
  const escalating = [
    year(2016, { commits: 100 }),
    year(2017, { commits: 120 }),
    year(2018, { commits: 150 }),
    year(2019, { commits: 4000, prs: 200, reviews: 300, issues: 100 }),
    year(2020, { commits: 5000, prs: 250, reviews: 350, issues: 120 }),
    year(2021, { commits: 6000, prs: 300, reviews: 400, issues: 140 }),
    year(2022, { commits: 7000, prs: 350, reviews: 450, issues: 160 }),
    year(2023, { commits: 8000, prs: 400, reviews: 500, issues: 180 }),
  ];

  it("repeat trophies demand a stronger profile: OVR 80 holds one, 87 two, 94 three", () => {
    const count = (overall: number) =>
      computeAwards(card({ years: escalating, overall })).filter((a) => a.key === "ballon_dor")
        .length;
    expect(count(80)).toBe(1);
    expect(count(86)).toBe(1);
    expect(count(87)).toBe(2);
    expect(count(93)).toBe(2);
    expect(count(94)).toBe(3);
  });

  it("never exceeds the cap, and icons get one more", () => {
    const gold = computeAwards(card({ years: escalating, finish: "gold", overall: 95 }));
    expect(gold.filter((a) => a.key === "ballon_dor")).toHaveLength(3);
    const icon = computeAwards(card({ years: escalating, finish: "icon", overall: 95 }));
    expect(icon.filter((a) => a.key === "ballon_dor")).toHaveLength(4);
  });

  it("a commits-only legend still wins (no balance requirement)", () => {
    const kernel = [
      year(2019, { commits: 900, restricted: 300 }),
      year(2020, { commits: 950, restricted: 320 }),
      year(2021, { commits: 4500, restricted: 2100 }),
      year(2022, { commits: 1000, restricted: 350 }),
    ];
    const got = computeAwards(card({ years: kernel })).filter((a) => a.key === "ballon_dor");
    expect(got.map((a) => a.year)).toEqual([2021]);
  });

  it("needs history: a single-year account gets none", () => {
    expect(keys(card({ years: [year(2026, { commits: 9000, prs: 500 })] }))).not.toContain("ballon_dor");
  });
});

describe("Clutch Performer", () => {
  const win = (yearNumber: number, commits: number): WcWindowTotals => ({
    ...year(yearNumber, { commits }), edition: `June ${yearNumber}`,
  });

  it("needs an unusually strong June compared with the same year's pace", () => {
    const years = [year(2022, { commits: 3650 })];
    const routine = computeAwards(card({ years }), [win(2022, 300)]);
    expect(routine.map((a) => a.key)).not.toContain("wc_golden_ball");
    const onFire = computeAwards(card({ years }), [win(2022, 500)]);
    expect(onFire.find((a) => a.key === "wc_golden_ball")?.edition).toBe("June 2022");
  });

  it("uses elapsed days for a partial current year", () => {
    const years = [year(2026, { commits: 2000 })];
    const got = computeAwards(card({ years }), [win(2026, 300)], new Date("2026-07-21T00:00:00Z"));
    expect(got.map((a) => a.key)).not.toContain("wc_golden_ball");
  });

  it("does not award unfinished or future June windows", () => {
    const got = computeAwards(card({ years: [year(2026, { commits: 1000 })] }),
      [win(2026, 900)], new Date("2026-06-15T00:00:00Z"));
    expect(got.map((a) => a.key)).not.toContain("wc_golden_ball");
  });

  it("requires yearly evidence and the overall floor", () => {
    expect(keys(card({ years: [] }), [win(2022, 900)])).not.toContain("wc_golden_ball");
    expect(keys(card({ overall: 79, years: [year(2022, { commits: 1000 })] }), [win(2022, 900)]))
      .not.toContain("wc_golden_ball");
  });

  it("can earn awards in multiple verified windows", () => {
    const c = card({ years: [year(2021, { commits: 1000 }), year(2022, { commits: 1000 })] });
    const got = computeAwards(c, [win(2021, 400), win(2022, 500)]);
    expect(got.filter((a) => a.key === "wc_golden_ball")).toHaveLength(2);
  });
});

describe("Scoring Champion", () => {
  const scorer = (position: Card["position"], sho: number, overall = 85) =>
    card({ position, overall, stats: { ath: 70, sho, pas: 70, hnd: 70, def: 70, reb: 70 } });

  it("recognizes elite scoring at every basketball position", () => {
    for (const pos of ["PG", "SG", "SF", "PF", "C"] as const)
      expect(keys(scorer(pos, 80))).toContain("golden_boot");
  });

  it("needs elite shooting and the profile floor", () => {
    expect(keys(scorer("SG", 79))).not.toContain("golden_boot");
    expect(keys(scorer("SG", 85, 79))).not.toContain("golden_boot");
  });
});

describe("Championship", () => {
  const elite = [2023, 2024, 2025].map((y) =>
    year(y, { commits: 2200, prs: 100, reviews: 100, issues: 50 }));

  it("needs three completed elite seasons and OVR 90", () => {
    const at = (c: Card) => computeAwards(c, [], new Date("2026-10-30T00:00:00Z")).map((a) => a.key);
    expect(at(card({ overall: 90, years: elite }))).toContain("world_cup");
    expect(at(card({ overall: 89, years: elite }))).not.toContain("world_cup");
    expect(at(card({ overall: 90, years: elite.slice(0, 2) }))).not.toContain("world_cup");
    expect(at(card({ overall: 90, years: [elite[0], elite[1], { ...elite[2], year: 2026 }] })))
      .not.toContain("world_cup");
  });

  it("cannot be minted by country, including the upstream Spain gift", () => {
    for (const country of ["es", "us", "fr", ""]) {
      expect(keys(card({ country, overall: 99 }))).not.toContain("world_cup");
    }
  });
});

describe("candidacy and grouping", () => {
  it("queries June windows only for strong profiles with relevant activity", () => {
    expect(wcBallCandidate(card({ overall: 79, years: [year(2022, { commits: 100 })] }))).toBe(false);
    expect(wcBallCandidate(card({ years: [year(2000, { commits: 100 })] }))).toBe(false);
    expect(wcBallCandidate(card({ years: [year(2022, { commits: 100 })] }))).toBe(true);
  });

  it("groups instances per award type in shelf order", () => {
    const groups = groupAwards([
      { key: "golden_boot", reason: "r" },
      { key: "ballon_dor", year: 2020, reason: "r" },
      { key: "ballon_dor", year: 2021, reason: "r" },
    ]);
    expect(groups.map((g) => g.key)).toEqual(["ballon_dor", "golden_boot"]);
    expect(groups[0].instances).toHaveLength(2);
  });
});

