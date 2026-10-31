import { type Country, searchCountries } from "./countries";

// The basketball nations GitHoop features, by region, keyed by the flag asset code
// we already ship (public/badges/flags/<code>.png). They lead the squads page, the
// flag picker and the leaderboard filter, so finding your national team doesn't
// mean scrolling past 200 countries. A test checks every code against a real
// country and a real flag asset.

export interface NationRegion {
  label: string;
  codes: readonly string[];
}

export const REGIONS: readonly NationRegion[] = [
  { label: "Americas", codes: ["us", "ca", "mx", "br", "ar", "pr", "do", "ve"] },
  { label: "Europe", codes: ["es", "fr", "de", "rs", "si", "gr", "lt", "it", "tr", "fi"] },
  { label: "Africa", codes: ["ng", "ss", "ao", "sn", "ci", "eg"] },
  { label: "Asia & Oceania", codes: ["au", "nz", "jp", "cn", "ph", "kr", "ir", "lb"] },
];

const FEATURED = new Set(REGIONS.flatMap((r) => r.codes));

/** True when `code` is a featured basketball nation. Case-insensitive. */
export function isFeaturedNation(code: string | null | undefined): boolean {
  return !!code && FEATURED.has(code.toLowerCase());
}

/**
 * Floats the featured nations to the top of a country list, keeping each group in
 * the order it came in. Returns a FLAT list plus the size of the featured block:
 * the picker's keyboard navigation and aria-activedescendant address options by
 * index, so grouping stays a rendering concern, not a data-shape one.
 */
export function featuredFirst(countries: readonly Country[]): {
  list: readonly Country[];
  featuredCount: number;
} {
  const featured: Country[] = [];
  const rest: Country[] = [];
  for (const c of countries) (isFeaturedNation(c.code) ? featured : rest).push(c);
  return { list: [...featured, ...rest], featuredCount: featured.length };
}

/**
 * The flag picker's list, and the size of its leading block (0 = show no group
 * headers). Only browsing is regrouped: while the user is searching,
 * searchCountries' prefix-over-substring ranking is what they're steering, and
 * floating the featured nations through it would put a substring match above a
 * prefix one.
 */
export function flagPickerList(query: string): {
  list: readonly Country[];
  featuredCount: number;
} {
  const matches = searchCountries(query);
  return query.trim() ? { list: matches, featuredCount: 0 } : featuredFirst(matches);
}
