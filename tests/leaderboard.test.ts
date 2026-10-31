import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  avatarAt,
  boardHref,
  formatRank,
  pageCount,
  pageOfRank,
  pageOffset,
  parseCountry,
  parsePage,
  parsePlayer,
  parseQuery,
  rankTier,
  resolvePage,
  rowId,
} from "@/lib/leaderboard";

// The leaderboard's URL contract: whatever lands in the query string renders a
// sensible board (never an error page), and the links it builds read back the same.

describe("query parsing", () => {
  it("reads a page number, defaulting anything odd to 1", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(" 12 ")).toBe(12);
    expect(parsePage(["4", "9"])).toBe(4);
    for (const bad of [undefined, "", "0", "-2", "1.5", "abc", "2e3", "9999999999"]) expect(parsePage(bad)).toBe(1);
  });

  it("keeps only country codes we ship a flag for, lowercased", () => {
    expect(parseCountry("BR")).toBe("br");
    expect(parseCountry("sct")).toBe("sct");
    expect(parseCountry("eu")).toBeNull(); // supranational pseudo-flag
    expect(parseCountry("zz")).toBeNull();
    expect(parseCountry(undefined)).toBeNull();
  });

  it("accepts GitHub-shaped logins, with or without the @", () => {
    expect(parsePlayer("torvalds")).toBe("torvalds");
    expect(parsePlayer(" @ThePrimeagen ")).toBe("ThePrimeagen");
    expect(parsePlayer("pewdiepie-archdaemon")).toBe("pewdiepie-archdaemon");
    for (const bad of [undefined, "", "@", "---", "has space", "a/b", "x".repeat(40)]) expect(parsePlayer(bad)).toBeNull();
  });

  it("parses a whole query", () => {
    expect(parseQuery({ page: "2", country: "US", player: "@t3dotgg" })).toEqual({
      page: 2,
      country: "us",
      player: "t3dotgg",
    });
    expect(parseQuery({})).toEqual({ page: 1, country: null, player: null });
  });
});

describe("page math", () => {
  it("counts pages, with an empty board still one page", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(PAGE_SIZE)).toBe(1);
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  });

  it("maps ranks to pages and pages to offsets", () => {
    expect(pageOfRank(1)).toBe(1);
    expect(pageOfRank(PAGE_SIZE)).toBe(1);
    expect(pageOfRank(PAGE_SIZE + 1)).toBe(2);
    expect(pageOffset(1)).toBe(0);
    expect(pageOffset(3)).toBe(2 * PAGE_SIZE);
  });

  it("jumps to a ranked player's page, else holds the request to the board", () => {
    expect(resolvePage(1, 340, 120)).toBe(3);
    expect(resolvePage(5, 340, null)).toBe(5);
    expect(resolvePage(99, 340, null)).toBe(7); // stale link lands on the last page
    expect(resolvePage(3, 0, undefined)).toBe(1);
  });
});

describe("links", () => {
  it("omits defaults and keeps a stable order", () => {
    expect(boardHref()).toBe("/leaderboard");
    expect(boardHref({ page: 1, country: null, player: null })).toBe("/leaderboard");
    expect(boardHref({ page: 2 })).toBe("/leaderboard?page=2");
    expect(boardHref({ page: 3, player: "torvalds", country: "us" })).toBe("/leaderboard?country=us&player=torvalds&page=3");
  });

  it("round-trips through the parser", () => {
    const q = { page: 4, country: "jp", player: "t3dotgg" };
    const params = Object.fromEntries(new URL(boardHref(q), "https://x.test").searchParams);
    expect(parseQuery(params)).toEqual(q);
  });

  it("gives each row a case-insensitive anchor", () => {
    expect(rowId("ThePrimeagen")).toBe("player-theprimeagen");
  });
});

describe("display helpers", () => {
  it("medals the podium and highlights the rest of the top 10", () => {
    expect([1, 2, 3].map(rankTier)).toEqual(["gold", "silver", "bronze"]);
    expect(rankTier(4)).toBe("top10");
    expect(rankTier(10)).toBe("top10");
    expect(rankTier(11)).toBeNull();
  });

  it("asks GitHub for a row-sized avatar, leaving other URLs alone", () => {
    expect(avatarAt("https://avatars.githubusercontent.com/u/1024025?s=480&v=4", 80)).toBe(
      "https://avatars.githubusercontent.com/u/1024025?s=80&v=4",
    );
    expect(avatarAt("https://avatars.githubusercontent.com/u/1", 80)).toBe("https://avatars.githubusercontent.com/u/1?s=80");
    expect(avatarAt("https://example.com/a.png", 80)).toBe("https://example.com/a.png");
    expect(avatarAt("", 80)).toBe("");
  });

  it("prints ranks with thousands separators", () => {
    expect(formatRank(12)).toBe("12");
    expect(formatRank(12340)).toBe("12,340");
  });
});
