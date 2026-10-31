import { describe, expect, it } from "vitest";
import { SAMPLE_CARDS } from "@/lib/github/samples";
import type { PlayerEntry } from "@/lib/registry";
import { withLiveRating } from "@/lib/showcase";

// The home fan: baked cards, with each player's live registry rating laid over.

const baked = SAMPLE_CARDS.find((c) => c.login === "ThePrimeagen")!;

const entry = (extra: Partial<PlayerEntry> = {}): PlayerEntry => ({
  login: baked.login,
  name: baked.name,
  avatarUrl: baked.avatarUrl,
  overall: baked.overall,
  position: baked.position,
  family: baked.family,
  finish: baked.finish,
  country: baked.country,
  topLanguage: baked.topLanguage ?? null,
  stats: baked.stats,
  ...extra,
});

describe("withLiveRating", () => {
  it("keeps the baked card without a live entry", () => {
    expect(withLiveRating(baked, null)).toBe(baked);
    expect(withLiveRating(baked, undefined)).toBe(baked);
  });

  it("shows the live rating, stats and position", () => {
    const stats = { ...baked.stats, ath: 99 };
    const card = withLiveRating(baked, entry({ overall: 99, position: "PG", stats }));
    expect(card.overall).toBe(99);
    expect(card.position).toBe("PG");
    expect(card.stats).toEqual(stats);
  });

  it("relabels a card that changed tier", () => {
    const card = withLiveRating(baked, entry({ finish: "gold" }));
    expect(card.finish).toBe("gold");
    expect(card.finishLabel).toBe("GOLD");
  });

  it("keeps the logo while the top language holds, and swaps it when it changes", () => {
    expect(withLiveRating(baked, entry()).languageLogo).toEqual(baked.languageLogo);
    const card = withLiveRating(baked, entry({ topLanguage: "Python" }));
    expect(card.topLanguage).toBe("Python");
    expect(card.languageLogo?.name).toBe("Python");
    expect(withLiveRating(baked, entry({ topLanguage: null })).languageLogo).toBeNull();
  });

  it("leaves the baked history alone", () => {
    const card = withLiveRating(baked, entry({ overall: 99 }));
    expect(card.report).toBe(baked.report);
    expect(card.awards).toBe(baked.awards);
  });
});
