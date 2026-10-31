// Compact number formatting for display (1240 → "1.2k", 248723 → "249k", 1250000 → "1.3M").
// One decimal below 10 units ("1.2k"), none above ("249k"), so the string stays short.
const compact = (n: number, unit: number, suffix: string): string => {
  const scaled = n / unit;
  return scaled.toFixed(scaled >= 10 ? 0 : 1).replace(/\.0$/, "") + suffix;
};

export const formatCount = (n: number): string => {
  if (n >= 1_000_000) return compact(n, 1_000_000, "M");
  if (n >= 1000) {
    const thousands = compact(n, 1000, "k");
    // 999_500+ rounds up to "1000k" (toFixed(0) rounds half-up at 999.5); roll
    // over to the next unit rather than printing a four-digit thousands value.
    return thousands === "1000k" ? compact(n, 1_000_000, "M") : thousands;
  }
  return String(Math.round(n));
};

// Market value in dollars, fictional basketball contract style: 47_000_000 → "$47M", 8_500_000 →
// "$8.5M", 450_000 → "$450K".
export const formatMoney = (dollars: number): string => {
  if (dollars >= 1_000_000) return "$" + compact(dollars, 1_000_000, "M");
  if (dollars >= 1000) {
    const thousands = compact(dollars, 1000, "K");
    return "$" + (thousands === "1000K" ? compact(dollars, 1_000_000, "M") : thousands);
  }
  return "$" + Math.round(dollars);
};

// Fixed-precision rounding for deterministic geometry / imperative transforms —
// shared so radar, VS burst and tilt all round identically.
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round1 = (n: number) => Math.round(n * 10) / 10;
