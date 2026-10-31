import { countryForLogin } from "../geo";
import { topLanguageLogo } from "../github/languages";
import { deriveMetrics, deriveHandles, deriveStyle, deriveOffHand, deriveWorkRate } from "./attributes";
import { ARCHETYPES, FINISH_LABELS, FOUNDER_OVERALL, FOUNDERS, K, SIGNAL_REFS, STATS, WEIGHTS } from "./constants";
import { derivePlaystyles } from "./playstyles";
import { outlook, seasonSignals } from "./progression";
import type { Archetype, Card, Family, Finish, Position, SeasonRating, Signals, StatKey, Stats } from "./types";

const Lg = (x: number) => Math.log10(Math.max(0, x) + 1);
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

// §1 — one GitHub count → a rating: zero → floor, typical → K.stat.typical,
// elite → 99, log-scaled in between (each 10× is worth the same within a segment).
// Club ratings (lib/scoring/club) use the same curve on their own anchors.
export function rate(value: number, ref: { typical: number; elite: number }): number {
  const { floor, typical } = K.stat;
  const x = Lg(value);
  const t = Lg(ref.typical);
  if (x <= t) return floor + (typical - floor) * (x / t);
  return typical + (99 - typical) * Math.min(1, (x - t) / (Lg(ref.elite) - t));
}

// §2 — the six stats, rated straight from the signals. Nothing is normalised
// against the player's own profile: the card shows what the signals earned.
function rateStats(s: Signals): Stats {
  const r = SIGNAL_REFS;
  const o: Stats = {
    ath: rate(s.recent_contributions, r.recentContributions),
    sho: 0.7 * rate(s.total_stars_owned, r.stars) + 0.3 * rate(s.max_repo_stars, r.topRepoStars),
    pas: 0.6 * rate(s.prs_to_others, r.prs) + 0.4 * rate(s.followers, r.followers),
    // Log-scaled like the rest, so each extra language counts for less.
    hnd: rate(s.languages, r.languages),
    def: rate(s.reviews + s.issues_closed, r.reviewsAndIssues),
    reb:
      0.7 * rate(s.total_contributions_lifetime, r.lifetimeContributions) +
      0.3 * rate(s.active_years, r.activeYears),
  };
  for (const k of STATS) o[k] = clamp(Math.round(o[k]), 1, 99);
  return o;
}

// §3 — archetype, then position. Stats are compared with the player's own
// average only to read the shape; the numbers themselves are never changed.
function classify(st: Stats): { family: Family; position: Position } {
  const m = mean(STATS.map((k) => st[k]));
  const dev = {} as Stats;
  STATS.forEach((k) => (dev[k] = st[k] - m));
  const avg = (ks: StatKey[]) => mean(ks.map((k) => dev[k]));
  const contrast = (a: (typeof ARCHETYPES)[number]) => avg(a.high) - avg(a.low);

  const fits =
    m < K.position.thinMean
      ? []
      : ARCHETYPES.filter(
          (a) => a.high.every((k) => dev[k] >= K.position.standOut) && a.low.every((k) => dev[k] < 0),
        ).sort((a, b) => contrast(b) - contrast(a));
  // Too thin to read, or nothing stands out: an Allrounder, who plays SF until
  // the user picks a position.
  if (!fits.length) return { family: "Allrounder", position: "SF" };
  const family = fits[0].family;
  return { family, position: splitPosition(family, dev) };
}

// Guards create and shoot; wings slash; interior players defend and rebound.
function splitPosition(family: Exclude<Family, "Allrounder">, dev: Stats): Position {
  switch (family) {
    case "Playmaker":
      return "PG";
    case "Shooter":
      return "SG";
    case "RimProtector":
      return dev.reb >= dev.ath ? "C" : "PF";
    case "Slasher":
      return dev.reb > dev.hnd ? "PF" : "SF";
  }
}

// §4 — position-weighted, never a flat mean; stats alone cap at 88.
function weightedOVR(stats: Stats, family: Family): number {
  const w = WEIGHTS[family];
  const ovr = STATS.reduce((s, k) => s + stats[k] * w[k], 0);
  return Math.min(Math.round(ovr), K.ovrCap);
}

// §5 — the 88→99 range is bought with years and sustained influence.
function legacyScore(s: Signals): number {
  const { a, b, c, d, e, f, activeCap } = K.legacy;
  const z =
    a * Math.log(s.account_age_years + 1) +
    b * Math.min(s.active_years, activeCap) +
    c * Lg(s.followers) +
    d * Lg(s.total_stars_owned) +
    e * Lg(s.max_repo_stars) -
    f;
  return sigmoid(z);
}

function pickFinish(overall: number, L: number, recentSpike: boolean, login: string): Finish {
  if (K.iconAllowlist.includes(login) || overall >= K.finish.iconMin) return "icon";
  if (overall >= K.finish.totyMin && L >= K.finish.totyLegacy) return "toty";
  if (recentSpike && overall >= K.finish.silverMin) return "totw";
  if (overall >= K.finish.goldMin) return "gold";
  if (overall >= K.finish.silverMin) return "silver";
  return "bronze";
}

function archetypeFromShape(st: Stats, finish: Finish): Archetype {
  if (finish === "icon")
    return { name: "Hall of Famer", blurb: "a legendary maintainer with influence earned over years" };
  const top = [...STATS].sort((a, b) => st[b] - st[a]);
  const peak = st[top[0]];
  const top2 = top.slice(0, 2);
  const has = (a: StatKey, b: StatKey) => top2.includes(a) && top2.includes(b);
  if (top[0] === "sho" && st.def < peak - 18 && st.pas < peak - 12)
    return { name: "Sharpshooter", blurb: "a pure scorer whose repositories keep drawing stars" };
  if (top[0] === "pas" && top2.includes("def"))
    return { name: "Floor General", blurb: "sets teammates up with cross-repo pull requests and reviews" };
  if (top[0] === "def" && top2.includes("pas"))
    return { name: "Two-Way Playmaker", blurb: "creates opportunities and protects the codebase with reviews" };
  if (top[0] === "hnd")
    return { name: "Shot Creator", blurb: "a versatile ball handler working across many stacks" };
  if (has("reb", "sho")) return { name: "Stretch Big", blurb: "combines a deep contribution history with long-range star power" };
  if (has("reb", "ath") || has("ath", "hnd"))
    return { name: "Slasher", blurb: "a relentless contributor who keeps attacking the next challenge" };
  if (top[0] === "def")
    return { name: "Rim Protector", blurb: "anchors the defense with reviews and issue resolution" };
  if (top[0] === "sho")
    return { name: "Sharpshooter", blurb: "a pure scorer whose repositories keep drawing stars" };
  return { name: "Two-Way Wing", blurb: "a dependable contributor who can help at either end of the court" };
}

// The whole rating for one set of signals, before any founder override. The live
// card and every rebuilt season go through it.
function rateSignals(s: Signals) {
  const stats = rateStats(s);
  const { position, family } = classify(stats);
  const baseOVR = weightedOVR(stats, family);
  const L = legacyScore(s);
  const overall = clamp(baseOVR + Math.round(K.legacy.bonusMax * L), 1, 99);
  return { stats, position, family, baseOVR, L, overall, finish: pickFinish(overall, L, s.recent_spike, s.login) };
}

// `now` dates the season history (the samples pass their capture date).
export function buildCard(s: Signals, now = new Date()): Card {
  const rated = rateSignals(s);
  const { stats, position, family, baseOVR, L } = rated;

  // Founders get a forced overall (>89) and the bespoke "founder" tier. We drive
  // `finish` directly rather than via pickFinish: any overall >= 90 would
  // otherwise auto-promote to ICON (and flip club/archetype), hijacking the look.
  const founder = FOUNDERS[s.login.toLowerCase()];
  const overall = founder ? FOUNDER_OVERALL[s.login.toLowerCase()] : rated.overall;
  const finish: Finish = founder ? "founder" : rated.finish;
  const seasons: SeasonRating[] = [
    ...seasonSignals(s, now).map(({ year, signals }) => {
      const r = rateSignals(signals);
      return { year, current: false, overall: r.overall, position: r.position, finish: r.finish, stats: r.stats };
    }),
    { year: now.getUTCFullYear(), current: true, overall, position, finish, stats },
  ];
  const archetype = founder
    ? { name: "Founder", blurb: "co-founder of GitHoop — they built the very scout reading this card" }
    : archetypeFromShape(stats, finish);
  const skill = deriveHandles(s);
  const weak = deriveOffHand(stats);
  const work = deriveWorkRate(stats);
  const style = deriveStyle(s);
  // Headline language's own catalog logo (null when it has none) — never a
  // different language's icon, so the logo always matches `topLanguage`.
  const languageLogo = topLanguageLogo(s.rankedLanguages ?? []);
  return {
    login: s.login,
    name: s.name,
    avatarUrl: s.avatarUrl,
    country: countryForLogin(s.login, s.location) ?? "",
    club: finish === "icon" ? "legends" : "neutral",
    stats,
    position,
    family,
    baseOVR,
    overall,
    finish,
    finishLabel: FINISH_LABELS[finish],
    archetype: archetype.name,
    archetypeBlurb: archetype.blurb,
    topLanguage: s.topLanguage ?? null,
    languageLogo,
    ...(founder ? { founder } : null),
    ...(s.years ? { years: s.years } : null),
    seasons,
    outlook: outlook(s, overall),
    legacy: { L },
    report: {
      handles: skill.value,
      offHand: weak.value,
      workRate: { attack: work.attack, defense: work.defense },
      style: style.value,
      reasons: {
        handles: skill.reason,
        offHand: weak.reason,
        workRate: work.reason,
        style: style.reason,
      },
      playstyles: derivePlaystyles(s),
      metrics: deriveMetrics(s),
    },
  };
}
