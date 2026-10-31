import { describe, expect, it } from "vitest";
import {
  buildClub,
  CLUB_REFS,
  clubFacts,
  clubFinish,
  pickSquad,
  rateClubStats,
  type ClubFacts,
  type SquadPlayer,
} from "@/lib/scoring/club";
import type { OrgPayload, OrgRepo } from "@/lib/github/org";
import type { Position } from "@/lib/scoring/types";

// The pure half of club mode: the club rating (anchors, facts, tier) and the
// squad (five starters, bench selection, out-of-position fill, partial rosters).

const NOW = new Date("2026-10-30T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const repo = (name: string, stars: number, extra: Partial<OrgRepo> = {}): OrgRepo => ({
  name,
  description: null,
  stars,
  forks: 0,
  language: "TypeScript",
  pushedAt: daysAgo(10),
  archived: false,
  ...extra,
});

const org = (extra: Partial<OrgPayload> = {}): OrgPayload => ({
  login: "acme",
  name: "Acme",
  avatarUrl: "https://example.com/acme.png",
  description: null,
  location: null,
  createdAt: NOW.toISOString(),
  publicRepos: 0,
  repos: [],
  recentPushes: [],
  contributors: [],
  sampledRepos: [],
  contributorsComplete: true,
  ...extra,
});

const factsAt = (pick: "typical" | "elite"): ClubFacts => ({
  activeRepos: CLUB_REFS.activeRepos[pick],
  stars: CLUB_REFS.stars[pick],
  topRepoStars: CLUB_REFS.topRepoStars[pick],
  contributors: CLUB_REFS.contributors[pick],
  languages: CLUB_REFS.languages[pick],
  forks: CLUB_REFS.forks[pick],
  publicRepos: CLUB_REFS.publicRepos[pick],
  ageYears: CLUB_REFS.ageYears[pick],
});

describe("club rating", () => {
  it("rates an empty, brand-new org at the floor", () => {
    const club = buildClub(org(), [], NOW);
    expect(Object.values(club.stats)).toEqual([40, 40, 40, 40, 40, 40]);
    expect(club.overall).toBe(40);
    expect(club.finish).toBe("bronze");
  });

  it("puts every anchor's typical value at 60 and its elite value at 99", () => {
    expect(Object.values(rateClubStats(factsAt("typical")))).toEqual([60, 60, 60, 60, 60, 60]);
    expect(Object.values(rateClubStats(factsAt("elite")))).toEqual([99, 99, 99, 99, 99, 99]);
  });

  it("caps at 99 past the elite anchor", () => {
    const f = factsAt("elite");
    expect(rateClubStats({ ...f, stars: f.stars * 50, forks: f.forks * 50 }).sho).toBe(99);
  });

  it("reads the facts from the payload: sums, distinct languages, 90-day pushes, age", () => {
    const f = clubFacts(
      org({
        createdAt: "2016-10-30T12:00:00Z",
        publicRepos: 42,
        repos: [
          repo("a", 1000, { forks: 30, language: "Go" }),
          repo("b", 200, { forks: 5, language: "Rust" }),
          repo("c", 50, { forks: 1, language: "Go" }),
          repo("d", 0, { language: null }),
        ],
        recentPushes: [daysAgo(1), daysAgo(89), daysAgo(91), daysAgo(400)],
        contributors: [
          { login: "x", avatarUrl: "", contributions: 9, repos: 1 },
          { login: "y", avatarUrl: "", contributions: 3, repos: 2 },
        ],
      }),
      NOW,
    );
    expect(f).toEqual({
      stars: 1250,
      topRepoStars: 1000,
      forks: 36,
      publicRepos: 42,
      activeRepos: 2,
      contributors: 2,
      languages: 2,
      ageYears: 10,
    });
  });

  it("tiers clubs on the player thresholds, without IN-FORM or the legacy gate", () => {
    expect([90, 89, 85, 84, 75, 74, 65, 64].map(clubFinish)).toEqual([
      "icon",
      "toty",
      "toty",
      "gold",
      "gold",
      "silver",
      "silver",
      "bronze",
    ]);
  });

  it("makes the overall the rounded average of the six stats", () => {
    const club = buildClub(
      org({
        createdAt: "2012-01-01T00:00:00Z",
        publicRepos: 300,
        repos: [repo("big", 50_000, { forks: 9_000 }), repo("small", 400, { language: "Python" })],
        recentPushes: Array.from({ length: 20 }, () => daysAgo(5)),
      }),
      [],
      NOW,
    );
    const avg = Object.values(club.stats).reduce((s, x) => s + x, 0) / 6;
    expect(club.overall).toBe(Math.round(avg));
    expect(club.finishLabel).toBe(club.finish.toUpperCase());
  });

  it("derives the display bits: name fallback, flag, main languages, top repos", () => {
    const club = buildClub(
      org({
        name: "  ",
        location: "Berlin, Germany",
        repos: [
          repo("css-heavy", 10, { language: "CSS" }),
          repo("css-2", 20, { language: "CSS" }),
          repo("css-3", 30, { language: "CSS" }),
          repo("api", 500, { language: "Go" }),
          repo("cli", 300, { language: "Go" }),
          repo("web", 900, { language: "TypeScript" }),
          repo("old", 5, { archived: true, description: "  legacy  " }),
        ],
      }),
      [],
      NOW,
    );
    expect(club.name).toBe("acme");
    expect(club.country).toBe("de");
    // Ranked by repo count, with styling languages below real programming languages.
    expect(club.languages).toEqual([
      { name: "Go", repos: 2 },
      { name: "TypeScript", repos: 2 },
      { name: "CSS", repos: 3 },
    ]);
    expect(club.languageLogo?.name).toBe("Go");
    expect(club.topRepos.map((r) => r.name)).toEqual(["web", "api", "cli", "css-3", "css-2"]);
  });
});

const player = (login: string, position: Position, overall: number, def = 50): SquadPlayer => ({
  login,
  name: login,
  avatarUrl: "",
  overall,
  position,
  finish: "gold",
  def,
  contributions: 0,
});

// n players at one position, best first from `top`.
const many = (prefix: string, position: Position, n: number, top: number) =>
  Array.from({ length: n }, (_, i) => player(`${prefix}${i + 1}`, position, top - i));

const logins = (slots: { player: SquadPlayer | null }[]) => slots.map((s) => s.player?.login ?? null);

describe("pickSquad", () => {
  const positions: Position[] = ["PG", "SG", "SF", "PF", "C"];
  it("fields one natural starter at every basketball position", () => {
    const squad = pickSquad(positions.map((position, i) => player(position, position, 80 + i)));
    expect(squad.formation).toBe("5v5");
    expect(squad.size).toBe(5);
    expect(squad.moved).toBe(0);
    expect(squad.bench).toEqual([]);
    for (const position of positions) expect(logins(squad.lines[position])).toEqual([position]);
  });

  it("keeps the remaining roster on the bench and excludes it from team rating", () => {
    const squad = pickSquad(positions.flatMap((position) => many(position, position, 4, 90)));
    expect(squad.size).toBe(5);
    expect(squad.bench).toHaveLength(10);
    expect(squad.rating).toBe(90);
    const fielded = Object.values(squad.lines).flat().map((slot) => slot.player!.login);
    expect(new Set([...fielded, ...squad.bench.map((p) => p.login)]).size).toBe(15);
  });

  it("uses the nearest open role and discloses out-of-position assignments", () => {
    const squad = pickSquad([player("pg", "PG", 90), player("spare", "PG", 85), player("center", "C", 80)]);
    expect(logins(squad.lines.SG)).toEqual(["spare"]);
    expect(squad.lines.SG[0].outOfPosition).toBe(true);
    expect(squad.lines.PG[0].outOfPosition).toBe(false);
    expect(squad.moved).toBe(1);
    expect(squad.size).toBe(3);
    expect(squad.rating).toBe(85);
  });

  it("leaves five empty slots with no contributors", () => {
    const squad = pickSquad([]);
    expect(squad.rating).toBeNull();
    expect(squad.size).toBe(0);
    expect(Object.values(squad.lines).map((slots) => slots.length)).toEqual([1, 1, 1, 1, 1]);
    expect(Object.values(squad.lines).flat().every((slot) => slot.player === null)).toBe(true);
  });

  it("ignores duplicate accounts and unsupported cached positions", () => {
    const squad = pickSquad([player("a", "PG", 90), player("A", "SG", 80), player("old", "UNKNOWN" as Position, 99)]);
    expect(squad.size).toBe(1);
    expect(logins(squad.lines.PG)).toEqual(["a"]);
  });

  it("resolves equal ratings by contributions then login", () => {
    const squad = pickSquad([
      { ...player("z", "PG", 90), contributions: 20 },
      { ...player("a", "PG", 90), contributions: 30 },
      { ...player("b", "PG", 90), contributions: 30 },
    ]);
    expect(logins(squad.lines.PG)).toEqual(["a"]);
    expect(logins(squad.lines.SG)).toEqual(["b"]);
  });
});
