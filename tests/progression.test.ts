import { describe, expect, it } from "vitest";
import { buildCard } from "@/lib/scoring/engine";
import { outlook, seasonSignals } from "@/lib/scoring/progression";
import { formatMoney } from "@/lib/format";
import type { Signals, YearBreakdown } from "@/lib/scoring/types";

const NOW = new Date("2026-07-01T00:00:00Z");
const yr = (year: number, commits: number, prs = 0, reviews = 0, issues = 0, restricted = 0): YearBreakdown => ({
  year,
  commits,
  prs,
  reviews,
  issues,
  restricted,
});

const base: Signals = {
  login: "someone",
  name: "Some One",
  avatarUrl: "",
  location: null,
  followers: 40,
  account_age_years: 4.5,
  public_repos: 12,
  total_stars_owned: 60,
  max_repo_stars: 30,
  languages: 5,
  recent_contributions: 900,
  active_days_recent: 200,
  active_years: 4,
  total_contributions_lifetime: 2100,
  prs_to_others: 40,
  reviews: 20,
  issues_closed: 10,
  recent_commits: 800,
  recent_spike: false,
  years: [yr(2022, 0), yr(2023, 300, 5), yr(2024, 400, 10, 4, 2), yr(2025, 600, 20, 10, 5, 50), yr(2026, 500, 15)],
};

describe("seasonSignals", () => {
  const seasons = seasonSignals(base, NOW);

  it("covers completed years only, from the first contribution", () => {
    expect(seasons.map((s) => s.year)).toEqual([2023, 2024, 2025]);
  });

  it("rebuilds each season's activity and the lifetime so far", () => {
    const s2025 = seasons[2].signals;
    expect(s2025.recent_contributions).toBe(600 + 20 + 10 + 5 + 50);
    expect(s2025.prs_to_others).toBe(20);
    expect(s2025.reviews).toBe(10);
    expect(s2025.recent_commits).toBe(650);
    expect(s2025.total_contributions_lifetime).toBe(305 + 416 + 685);
  });

  it("ages the account back to each season's end and keeps today's stars and followers", () => {
    expect(seasons[2].signals.account_age_years).toBeCloseTo(4.5 - 0.5, 1);
    expect(seasons[0].signals.account_age_years).toBeCloseTo(4.5 - 2.5, 1);
    expect(seasons[0].signals.total_stars_owned).toBe(60);
    expect(seasons[0].signals.followers).toBe(40);
  });

  it("is empty without a yearly history", () => {
    expect(seasonSignals({ ...base, years: undefined }, NOW)).toEqual([]);
  });
});

describe("buildCard seasons", () => {
  it("ends with the live card and lists seasons oldest first", () => {
    const card = buildCard(base, NOW);
    const seasons = card.seasons ?? [];
    expect(seasons.map((s) => s.year)).toEqual([2023, 2024, 2025, 2026]);
    const last = seasons[seasons.length - 1];
    expect(last.current).toBe(true);
    expect(last.overall).toBe(card.overall);
    expect(last.stats).toEqual(card.stats);
  });

  it("rates a busier season higher than a quieter one", () => {
    const seasons = buildCard(base, NOW).seasons ?? [];
    expect(seasons[2].overall).toBeGreaterThan(seasons[0].overall);
  });
});

describe("outlook", () => {
  it("keeps potential between the overall and 99", () => {
    for (const age of [0.2, 3, 8, 20]) {
      const o = outlook({ ...base, account_age_years: age }, 70);
      expect(o.potential).toBeGreaterThanOrEqual(70);
      expect(o.potential).toBeLessThanOrEqual(99);
    }
    expect(outlook({ ...base, account_age_years: 1 }, 97).potential).toBe(99);
  });

  it("gives younger, daily coders more room to grow", () => {
    const young = outlook({ ...base, account_age_years: 1, active_days_recent: 300 }, 65);
    const youngIdle = outlook({ ...base, account_age_years: 1, active_days_recent: 10 }, 65);
    const veteran = outlook({ ...base, account_age_years: 14, active_days_recent: 300 }, 65);
    expect(young.potential).toBeGreaterThan(youngIdle.potential);
    expect(young.potential).toBeGreaterThan(veteran.potential);
    expect(veteran.potential).toBe(65);
  });

  it("values a higher overall more and discounts age past 30", () => {
    const at = (overall: number, age: number) => outlook({ ...base, account_age_years: age }, overall).value;
    expect(at(80, 15)).toBeGreaterThan(at(70, 15));
    expect(at(90, 15)).toBeGreaterThan(at(80, 15));
    expect(at(85, 20)).toBeLessThan(at(85, 13));
    expect(outlook({ ...base, account_age_years: 12 }, 85).valueParts.age).toBe(1);
  });
});

describe("formatMoney", () => {
  it("prints fictional trade-value style amounts", () => {
    expect(formatMoney(150_000_000)).toBe("$150M");
    expect(formatMoney(8_500_000)).toBe("$8.5M");
    expect(formatMoney(450_000)).toBe("$450K");
    expect(formatMoney(999_600)).toBe("$1M");
    expect(formatMoney(640)).toBe("$640");
  });
});
