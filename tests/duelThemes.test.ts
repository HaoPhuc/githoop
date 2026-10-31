import { describe, expect, it } from "vitest";
import { RESULT_THEME, duelThemes } from "@/components/finishTheme";
import type { Card } from "@/lib/scoring/types";
import type { Finish } from "@/lib/scoring/types";

// The Duel kit-clash rule is deliberately surgical: ONLY a toty vs silver pairing
// recolors (both inks are pale), and it's always the toty side that swaps to its
// saturated tier orange. Every other matchup — including same-tier duels and the
// gold/icon near-twins — keeps its true tier inks.

const card = (finish: Finish): Card => ({ finish }) as Card;
const ALL_STAR_ORANGE = "#FF9A2E";

describe("duelThemes (kit clash)", () => {
  it("toty vs silver: the toty side wears the saturated tier orange, silver stays silver", () => {
    const { home, away } = duelThemes(card("toty"), card("silver"));
    expect(home.ink).toBe(ALL_STAR_ORANGE);
    expect(away).toEqual(RESULT_THEME.silver);
  });

  it("silver vs toty: same rule from the other corner", () => {
    const { home, away } = duelThemes(card("silver"), card("toty"));
    expect(home).toEqual(RESULT_THEME.silver);
    expect(away.ink).toBe(ALL_STAR_ORANGE);
  });

  it("totw keeps its own colour vs silver", () => {
    expect(duelThemes(card("totw"), card("silver")).home).toEqual(RESULT_THEME.totw);
    expect(duelThemes(card("silver"), card("totw")).away).toEqual(RESULT_THEME.totw);
  });

  it("no other matchup is touched — not even the near-twin golds or same-tier duels", () => {
    expect(duelThemes(card("gold"), card("icon"))).toEqual({
      home: RESULT_THEME.gold,
      away: RESULT_THEME.icon,
    });
    expect(duelThemes(card("gold"), card("gold"))).toEqual({
      home: RESULT_THEME.gold,
      away: RESULT_THEME.gold,
    });
    expect(duelThemes(card("toty"), card("gold"))).toEqual({
      home: RESULT_THEME.toty,
      away: RESULT_THEME.gold,
    });
    expect(duelThemes(card("toty"), card("toty"))).toEqual({
      home: RESULT_THEME.toty,
      away: RESULT_THEME.toty,
    });
  });
});
