import { describe, expect, it } from "vitest";
import { SAMPLE_CARDS } from "@/lib/github/samples";

// Locks the showcase invariants: snapshot countries, and the language logo
// matching the headline language (no fall-through to a different icon).
describe("showcase samples", () => {
  const by = Object.fromEntries(SAMPLE_CARDS.map((c) => [c.login, c]));

  it("identifies bundled snapshots separately from live scouting", () => {
    for (const card of SAMPLE_CARDS) {
      expect(card.sampledAt).toBe("2026-07-21T00:00:00.000Z");
      expect(card.builtAt).toBeUndefined();
    }
  });

  it("uses basketball positions for both live cards and historical seasons", () => {
    const positions = ["PG", "SG", "SF", "PF", "C"];
    for (const card of SAMPLE_CARDS) {
      expect(positions).toContain(card.position);
      expect(Object.keys(card.stats).sort()).toEqual(["ath", "def", "hnd", "pas", "reb", "sho"]);
      for (const season of card.seasons ?? []) expect(positions).toContain(season.position);
    }
  });

  it("preserves the snapshot countries", () => {
    expect(by["torvalds"].country).toBe("us"); // Portland location in the snapshot
    expect(by["pewdiepie-archdaemon"].country).toBe("se"); // Sweden
    expect(by["ThePrimeagen"].country).toBe("us");
    expect(by["t3dotgg"].country).toBe("us");
  });

  it("language logo matches the top language (Devicon), never a mismatch", () => {
    // ThePrimeagen's #1 is Rust — Devicon has it, so the Rust logo, not a TS icon.
    expect(by["ThePrimeagen"].topLanguage).toBe("Rust");
    expect(by["ThePrimeagen"].languageLogo).toEqual({ name: "Rust", slug: "rust-original" });
    expect(by["torvalds"].languageLogo).toEqual({ name: "C", slug: "c-original" });
    expect(by["t3dotgg"].languageLogo).toEqual({ name: "TypeScript", slug: "typescript-original" });
  });
});
