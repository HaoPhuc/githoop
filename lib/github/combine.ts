import type { YearBreakdown } from "@/lib/scoring/types";
import type { RawPayload } from "./client";

const DAYS_IN_YEAR = 365;

// One person's GitHub accounts as one profile, for a merged card (lib/merge). The
// main account gives the identity; the rest fills gaps in it. Activity and reach
// add up, and the account's age is the oldest one's. The sums can overcount a
// little: GitHub only gives totals, so a follower of both accounts counts twice,
// and so does a day active on both (capped at a full year).
export function combinePayloads(main: RawPayload, alts: RawPayload[]): RawPayload {
  if (!alts.length) return main;
  const all = [main, ...alts];
  const total = (field: (p: RawPayload) => number) => all.reduce((sum, p) => sum + field(p), 0);

  const years = new Map<number, YearBreakdown>();
  for (const y of all.flatMap((p) => p.years)) {
    const seen = years.get(y.year);
    years.set(
      y.year,
      seen
        ? {
            year: y.year,
            commits: seen.commits + y.commits,
            prs: seen.prs + y.prs,
            reviews: seen.reviews + y.reviews,
            issues: seen.issues + y.issues,
            restricted: seen.restricted + y.restricted,
          }
        : y,
    );
  }

  // The weekly lists end on the same week, so they line up from the end.
  const longest = Math.max(...all.map((p) => p.recentWeeks.length));
  const recentWeeks = Array.from({ length: longest }, (_, i) =>
    all.reduce((sum, p) => sum + (p.recentWeeks[p.recentWeeks.length - longest + i] ?? 0), 0),
  );

  return {
    ...main,
    name: main.name ?? alts.find((p) => p.name)?.name ?? null,
    location: main.location ?? alts.find((p) => p.location)?.location ?? null,
    createdAt: all.map((p) => p.createdAt).reduce((a, b) => (Date.parse(b) < Date.parse(a) ? b : a)),
    followers: total((p) => p.followers),
    publicRepos: total((p) => p.publicRepos),
    repos: all.flatMap((p) => p.repos),
    languageRepos: all.flatMap((p) => p.languageRepos),
    orgs: [...new Set(all.flatMap((p) => p.orgs))],
    recentCommits: total((p) => p.recentCommits),
    recentPRs: total((p) => p.recentPRs),
    recentReviews: total((p) => p.recentReviews),
    recentIssues: total((p) => p.recentIssues),
    recentRestricted: total((p) => p.recentRestricted),
    recentActiveDays: Math.min(DAYS_IN_YEAR, total((p) => p.recentActiveDays)),
    recentWeeks,
    lifetimeContributions: total((p) => p.lifetimeContributions),
    years: [...years.values()].sort((a, b) => a.year - b.year),
  };
}
