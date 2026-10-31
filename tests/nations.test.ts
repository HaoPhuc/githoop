import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countryName, normalizeCountry, searchCountries } from "@/lib/countries";
import { REGIONS, featuredFirst, flagPickerList, isFeaturedNation } from "@/lib/nations";

// The nation list is hand-written data, so the tests treat it as data: they check
// it against the two things that can silently break the picker, a code that isn't
// a real country and a code with no flag behind it. The rest pins the ordering the
// picker relies on.

const CODES = REGIONS.flatMap((r) => r.codes);

describe("REGIONS", () => {
  it("lists no nation twice", () => {
    expect(new Set(CODES).size).toBe(CODES.length);
  });

  it("gives every nation a code that resolves to a real country", () => {
    for (const code of CODES) {
      expect(normalizeCountry(code), code).toBe(code);
      expect(countryName(code), code).toBeTruthy();
    }
  });

  it("gives every nation a flag asset that actually exists on disk", () => {
    for (const code of CODES) {
      expect(existsSync(join(process.cwd(), "public", "badges", "flags", `${code}.png`)), code).toBe(true);
    }
  });
});

describe("isFeaturedNation", () => {
  it("matches case-insensitively and is false for the rest", () => {
    expect(isFeaturedNation("rs")).toBe(true);
    expect(isFeaturedNation("RS")).toBe(true);
    expect(isFeaturedNation("dk")).toBe(false);
  });

  it("is safe on empty / missing input", () => {
    expect(isFeaturedNation("")).toBe(false);
    expect(isFeaturedNation(null)).toBe(false);
    expect(isFeaturedNation(undefined)).toBe(false);
  });
});

describe("featuredFirst", () => {
  const of = (...codes: string[]) => codes.map((code) => ({ code, name: code.toUpperCase() }));

  it("floats featured nations above everyone else, keeping each group's order", () => {
    const { list, featuredCount } = featuredFirst(of("dk", "rs", "be", "fr"));
    expect(list.map((c) => c.code)).toEqual(["rs", "fr", "dk", "be"]);
    expect(featuredCount).toBe(2);
  });

  it("keeps the full country list intact, just reordered", () => {
    const all = searchCountries("");
    const { list, featuredCount } = featuredFirst(all);
    expect(list).toHaveLength(all.length);
    expect(featuredCount).toBe(CODES.length);
    expect(new Set(list.map((c) => c.code))).toEqual(new Set(all.map((c) => c.code)));
  });

  it("returns an empty result untouched", () => {
    expect(featuredFirst([])).toEqual({ list: [], featuredCount: 0 });
  });
});

describe("flagPickerList", () => {
  it("leads the browse list with the featured nations", () => {
    const { list, featuredCount } = flagPickerList("");
    expect(list.slice(0, featuredCount).every((c) => isFeaturedNation(c.code))).toBe(true);
    expect(list.slice(featuredCount).some((c) => isFeaturedNation(c.code))).toBe(false);
  });

  // searchCountries ranks prefix matches above substring ones; floating the
  // featured nations through a search would break that.
  it("does not reorder a search, so prefix still beats substring", () => {
    const { list, featuredCount } = flagPickerList("ma");
    expect(list).toEqual(searchCountries("ma"));
    expect(list[0].name).toBe("Macao");
    expect(featuredCount).toBe(0); // the picker draws no group headers
  });
});
