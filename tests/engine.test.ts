import { describe, expect, it } from "vitest";
import { buildCard } from "@/lib/scoring/engine";
import type { Signals } from "@/lib/scoring/types";

// A modest, non-founder profile — exercises the normal scoring path.
const base: Signals = {
  login: "octocat",
  name: "The Octocat",
  avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
  location: "San Francisco",
  followers: 50,
  account_age_years: 3,
  public_repos: 20,
  total_stars_owned: 100,
  max_repo_stars: 40,
  languages: 5,
  rankedLanguages: ["TypeScript", "Go"],
  topLanguage: "TypeScript",
  recent_contributions: 300,
  active_days_recent: 100,
  active_years: 3,
  total_contributions_lifetime: 1500,
  prs_to_others: 5,
  reviews: 3,
  issues_closed: 4,
  recent_commits: 280,
  recent_spike: false,
};

const withLogin = (login: string): Signals => ({ ...base, login });

describe("buildCard — equal scoring", () => {
  it("rates upstream founders from their real signals like every other profile", () => {
    const expected = buildCard(withLogin("some-random-dev"));
    for (const login of ["younesfdj", "MAWSIS", "torvalds"]) {
      const card = buildCard(withLogin(login));
      expect(card.overall).toBe(expected.overall);
      expect(card.finish).toBe(expected.finish);
      expect(card.founder).toBeUndefined();
    }
  });
});

// An account with nothing on it; each case below adds only the signals it needs.
const empty: Signals = {
  ...base,
  login: "someone",
  followers: 0,
  public_repos: 0,
  total_stars_owned: 0,
  max_repo_stars: 0,
  languages: 0,
  recent_contributions: 0,
  active_days_recent: 0,
  active_years: 0,
  total_contributions_lifetime: 0,
  prs_to_others: 0,
  reviews: 0,
  issues_closed: 0,
  recent_commits: 0,
};
const dev = (over: Partial<Signals>) => buildCard({ ...empty, ...over });

describe("buildCard — stats rated straight from the signals", () => {
  it("puts an empty account at the floor", () => {
    expect(dev({}).stats).toEqual({ ath: 40, sho: 40, pas: 40, hnd: 40, def: 40, reb: 40 });
  });

  it("rates typical counts at 60 and elite ones at 99", () => {
    const typical = dev({
      recent_contributions: 400,
      total_stars_owned: 30,
      max_repo_stars: 15,
      prs_to_others: 30,
      followers: 30,
      languages: 5,
      reviews: 20,
      issues_closed: 10,
      total_contributions_lifetime: 2000,
      active_years: 4,
    });
    expect(typical.stats).toEqual({ ath: 60, sho: 60, pas: 60, hnd: 60, def: 60, reb: 60 });
    const elite = dev({
      recent_contributions: 9000,
      total_stars_owned: 500_000,
      max_repo_stars: 400_000,
      prs_to_others: 5000,
      followers: 300_000,
      languages: 25,
      reviews: 4000,
      issues_closed: 1000,
      total_contributions_lifetime: 90_000,
      active_years: 15,
    });
    expect(elite.stats).toEqual({ ath: 99, sho: 99, pas: 99, hnd: 99, def: 99, reb: 99 });
  });

  it("keeps each stat to its own signals (no curving against the rest of the card)", () => {
    const before = dev({ recent_contributions: 800, languages: 4 });
    const after = dev({ recent_contributions: 800, languages: 4, total_stars_owned: 50_000, max_repo_stars: 40_000 });
    expect(after.stats.sho).toBeGreaterThan(before.stats.sho);
    expect({ ...after.stats, sho: 0 }).toEqual({ ...before.stats, sho: 0 });
  });

  it("separates big star counts instead of capping them all at 99", () => {
    const sho = (stars: number) => dev({ total_stars_owned: stars, max_repo_stars: stars / 2 }).stats.sho;
    expect(sho(10_000)).toBeLessThan(sho(50_000));
    expect(sho(50_000)).toBeLessThan(sho(200_000));
  });
});

describe("buildCard — archetype and position", () => {
  const active = { recent_contributions: 400, languages: 5, total_contributions_lifetime: 2000, active_years: 4 };

  it("makes a thin profile an Allrounder playing SF", () => {
    const card = dev({ recent_contributions: 30, languages: 1, total_contributions_lifetime: 40, active_years: 1 });
    expect(card.family).toBe("Allrounder");
    expect(card.position).toBe("SF");
  });

  it("makes a flat profile an Allrounder", () => {
    const card = dev({ ...active, total_stars_owned: 30, max_repo_stars: 15, prs_to_others: 30, followers: 30, reviews: 30 });
    expect(card.family).toBe("Allrounder");
  });

  it("scouts a star-magnet with little defending as a Shooter", () => {
    const quiet = dev({ ...active, recent_contributions: 60, total_stars_owned: 8000, max_repo_stars: 7800 });
    expect(quiet.family).toBe("Shooter");
    expect(quiet.position).toBe("SG");
    const busy = dev({ ...active, recent_contributions: 3000, total_stars_owned: 8000, max_repo_stars: 7800 });
    expect(busy.position).toBe("SG");
  });

  it("scouts a busy developer with no stars as a Slasher", () => {
    const card = dev({ ...active, recent_contributions: 1500, languages: 3, prs_to_others: 30, followers: 30, reviews: 30 });
    expect(card.family).toBe("Slasher");
    expect(card.position).toBe("PF");
    expect(dev({ ...active, recent_contributions: 1500, languages: 12, prs_to_others: 30, followers: 30, reviews: 30 }).position).toBe("SF");
  });

  it("scouts a heavy reviewer as an RimProtector", () => {
    const card = dev({
      ...active,
      reviews: 900,
      issues_closed: 300,
      total_contributions_lifetime: 15_000,
      active_years: 8,
      languages: 3,
    });
    expect(card.family).toBe("RimProtector");
    expect(card.position).toBe("C");
  });

  it("scouts a polyglot collaborator as a Playmaker", () => {
    const card = dev({
      ...active,
      languages: 15,
      prs_to_others: 400,
      followers: 800,
      total_contributions_lifetime: 900,
      active_years: 2,
    });
    expect(card.family).toBe("Playmaker");
    expect(card.position).toBe("PG");
  });
});
