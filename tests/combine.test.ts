import { describe, expect, it } from "vitest";
import type { RawPayload } from "@/lib/github/client";
import { combinePayloads } from "@/lib/github/combine";

// One person's accounts as one profile: the main account's identity, everything
// else added up.

const payload = (over: Partial<RawPayload> = {}): RawPayload => ({
  login: "main",
  name: "Main",
  avatarUrl: "https://a/main",
  location: "Hanoi",
  createdAt: "2020-01-01T00:00:00Z",
  followers: 10,
  publicRepos: 5,
  repos: [{ stars: 100, language: "Go", createdAt: "2020-01-01", pushedAt: "2026-01-01" }],
  languageRepos: [{ language: "Go" }],
  orgs: ["acme"],
  recentCommits: 100,
  recentPRs: 10,
  recentReviews: 5,
  recentIssues: 2,
  recentRestricted: 50,
  recentActiveDays: 200,
  recentWeeks: [1, 2, 3],
  lifetimeContributions: 1000,
  years: [{ year: 2025, commits: 100, prs: 10, reviews: 5, issues: 2, restricted: 50 }],
  ...over,
});

const alt = (over: Partial<RawPayload> = {}) =>
  payload({
    login: "alt",
    name: "Alt",
    avatarUrl: "https://a/alt",
    location: "Saigon",
    createdAt: "2018-06-01T00:00:00Z",
    repos: [{ stars: 50, language: "Rust", createdAt: "2018-06-01", pushedAt: "2026-02-01" }],
    languageRepos: [{ language: "Rust" }],
    orgs: ["acme", "bigco"],
    years: [
      { year: 2024, commits: 1, prs: 1, reviews: 1, issues: 1, restricted: 1 },
      { year: 2025, commits: 2, prs: 2, reviews: 2, issues: 2, restricted: 2 },
    ],
    ...over,
  });

describe("combinePayloads", () => {
  it("returns the main account untouched with nothing to merge", () => {
    const main = payload();
    expect(combinePayloads(main, [])).toBe(main);
  });

  it("keeps the main account's identity", () => {
    const c = combinePayloads(payload(), [alt()]);
    expect(c.login).toBe("main");
    expect(c.name).toBe("Main");
    expect(c.avatarUrl).toBe("https://a/main");
    expect(c.location).toBe("Hanoi");
  });

  it("fills a gap in the identity from another account", () => {
    const c = combinePayloads(payload({ name: null, location: null }), [alt()]);
    expect(c.name).toBe("Alt");
    expect(c.location).toBe("Saigon");
  });

  it("takes the oldest account's age", () => {
    expect(combinePayloads(payload(), [alt()]).createdAt).toBe("2018-06-01T00:00:00Z");
    expect(combinePayloads(payload(), [alt({ createdAt: "2024-01-01T00:00:00Z" })]).createdAt).toBe(
      "2020-01-01T00:00:00Z",
    );
  });

  it("adds up reach and activity", () => {
    const c = combinePayloads(payload(), [alt()]);
    expect(c.followers).toBe(20);
    expect(c.publicRepos).toBe(10);
    expect(c.recentCommits).toBe(200);
    expect(c.recentPRs).toBe(20);
    expect(c.recentReviews).toBe(10);
    expect(c.recentIssues).toBe(4);
    expect(c.recentRestricted).toBe(100);
    expect(c.lifetimeContributions).toBe(2000);
  });

  it("pools repos and languages, and lists each org once", () => {
    const c = combinePayloads(payload(), [alt()]);
    expect(c.repos.map((r) => r.stars)).toEqual([100, 50]);
    expect(c.languageRepos).toEqual([{ language: "Go" }, { language: "Rust" }]);
    expect(c.orgs).toEqual(["acme", "bigco"]);
  });

  it("caps active days at a full year", () => {
    expect(combinePayloads(payload(), [alt()]).recentActiveDays).toBe(365);
    expect(combinePayloads(payload({ recentActiveDays: 40 }), [alt({ recentActiveDays: 10 })]).recentActiveDays).toBe(50);
  });

  it("adds the weekly activity together, lined up on the latest week", () => {
    expect(combinePayloads(payload(), [alt({ recentWeeks: [10, 20, 30] })]).recentWeeks).toEqual([11, 22, 33]);
    expect(combinePayloads(payload(), [alt({ recentWeeks: [20, 30] })]).recentWeeks).toEqual([1, 22, 33]);
    expect(combinePayloads(payload({ recentWeeks: [] }), [alt({ recentWeeks: [] })]).recentWeeks).toEqual([]);
  });

  it("adds years together, oldest first", () => {
    expect(combinePayloads(payload(), [alt()]).years).toEqual([
      { year: 2024, commits: 1, prs: 1, reviews: 1, issues: 1, restricted: 1 },
      { year: 2025, commits: 102, prs: 12, reviews: 7, issues: 4, restricted: 52 },
    ]);
  });

  it("takes more than one other account", () => {
    expect(combinePayloads(payload(), [alt(), alt({ login: "third" })]).followers).toBe(30);
  });
});
