import { describe, expect, it } from "vitest";
import { buildCard } from "@/lib/scoring/engine";
import { signalsFromPayload } from "@/lib/github/signals";
import type { RawPayload } from "@/lib/github/client";
import { WEEKS, evenWeeks, weekCells, weeklyTotals, yearRingUri, type RingPalette } from "@/lib/yearRing";
import { CARD_THEME } from "@/components/finishTheme";

const PALETTE: RingPalette = ["#000001", "#000002", "#000003", "#000004", "#000005"];
const PAYLOAD: RawPayload = {
  login: "someuser",
  name: null,
  avatarUrl: "",
  location: null,
  createdAt: "2020-01-01T00:00:00Z",
  followers: 0,
  publicRepos: 0,
  repos: [],
  languageRepos: [],
  recentCommits: 0,
  orgs: [],
  recentPRs: 0,
  recentReviews: 0,
  recentIssues: 0,
  recentRestricted: 0,
  recentActiveDays: 0,
  recentWeeks: new Array<number>(WEEKS).fill(3),
  lifetimeContributions: 0,
  years: [],
};
const svgOf = (uri: string) => atob(uri.replace("data:image/svg+xml;base64,", ""));
// The d attribute of one palette colour's path, or "" when nothing used it.
const cellsIn = (svg: string, color: string) => svg.match(new RegExp(`d="([^"]*)" fill="${color}"`))?.[1].split("Z").length ?? 1;

describe("weeklyTotals", () => {
  it("sums a full calendar into 52 weeks, oldest first", () => {
    const days = Array.from({ length: 364 }, (_, i) => (i < 7 ? 1 : i >= 357 ? 2 : 0));
    const weeks = weeklyTotals(days);
    expect(weeks).toHaveLength(WEEKS);
    expect(weeks[0]).toBe(7);
    expect(weeks[51]).toBe(14);
    expect(weeks.slice(1, 51).every((n) => n === 0)).toBe(true);
  });

  it("counts back from today, so the newest week is whole and older days fall off", () => {
    const days = [99, ...new Array<number>(363).fill(0), 1, 1, 1, 1, 1, 1, 1];
    expect(weeklyTotals(days)[51]).toBe(7);
    expect(weeklyTotals(days).reduce((a, b) => a + b, 0)).toBe(7);
  });

  it("pads a short calendar with empty weeks at the old end", () => {
    const weeks = weeklyTotals([1, 2, 3]);
    expect(weeks).toHaveLength(WEEKS);
    expect(weeks[51]).toBe(6);
    expect(weeks.slice(0, 51).every((n) => n === 0)).toBe(true);
  });
});

describe("weekCells", () => {
  it("leaves an empty week dark and always shows any activity", () => {
    expect(weekCells(0)).toBe(0);
    expect(weekCells(1)).toBe(1);
  });

  it("takes twice the work for each extra cell, and tops out at a full ray", () => {
    expect(weekCells(3)).toBe(2);
    expect(weekCells(7)).toBe(3);
    expect(weekCells(63)).toBe(6);
    expect(weekCells(64)).toBe(7);
    expect(weekCells(5000)).toBe(7);
  });
});

describe("evenWeeks", () => {
  it("grows with the finish, from a thin bronze ring to a full icon one", () => {
    expect(weekCells(evenWeeks("bronze")[0])).toBe(2);
    expect(weekCells(evenWeeks("gold")[0])).toBe(4);
    expect(weekCells(evenWeeks("icon")[0])).toBe(7);
    expect(evenWeeks("gold")).toHaveLength(WEEKS);
  });
});

describe("yearRingUri", () => {
  it("draws all 364 cells unlit for a silent year", () => {
    const svg = svgOf(yearRingUri(new Array<number>(WEEKS).fill(0), PALETTE));
    expect(cellsIn(svg, PALETTE[0]) - 1).toBe(364);
    expect(svg).not.toContain(PALETTE[4]);
  });

  it("lights every cell of a flat-out year, keeping the rating column quiet", () => {
    const svg = svgOf(yearRingUri(new Array<number>(WEEKS).fill(100), PALETTE));
    expect(svg).not.toContain(PALETTE[0]);
    expect(cellsIn(svg, PALETTE[1])).toBeGreaterThan(1); // the cells behind the rating
    expect(cellsIn(svg, PALETTE[4])).toBeGreaterThan(cellsIn(svg, PALETTE[2]));
  });

  it("treats a short list as empty weeks instead of failing", () => {
    expect(svgOf(yearRingUri([100], PALETTE))).toContain(PALETTE[0]);
  });

  it("gives every finish but the founders a ring, and nobody a broken palette", () => {
    for (const [finish, theme] of Object.entries(CARD_THEME)) {
      if (finish === "founder") expect(theme.ring).toBeUndefined();
      else expect(theme.ring).toHaveLength(5);
    }
  });
});

describe("card data", () => {
  it("carries the weekly totals from the GitHub payload onto the card", () => {
    expect(buildCard(signalsFromPayload(PAYLOAD)).weeks).toEqual(PAYLOAD.recentWeeks);
  });

  it("leaves them off a card whose signals have none, so it falls back to the even ring", () => {
    expect(buildCard({ ...signalsFromPayload(PAYLOAD), recent_weeks: undefined }).weeks).toBeUndefined();
  });
});
