import type { AwardInstance, AwardKey, Card, YearBreakdown } from "@/lib/scoring/types";

// Basketball achievements derived from GitHub activity. Internal award keys
// retain upstream serialization compatibility; display names and rules are
// GitHoop-specific. No award asserts a real-world sports result.

export type { AwardInstance, AwardKey } from "@/lib/scoring/types";

export interface AwardMeta {
  title: string;
  shelfLabel: string;
  metricLabel: string; // the badge pill in the details modal
  description: string;
}

export const AWARD_META: Record<AwardKey, AwardMeta> = {
  ballon_dor: {
    title: "Most Valuable Player",
    shelfLabel: "MVP",
    metricLabel: "Year of a Legend",
    description:
      "The game's highest individual honour, for a calendar year that towers over the rest of a career. Any position, any style. What counts is that the year was undeniable.",
  },
  wc_golden_ball: {
    title: "Clutch Performer",
    shelfLabel: "CLUTCH",
    metricLabel: "June Hot Streak",
    description:
      "A GitHoop award for rising above your usual contribution pace during June. These fixed development windows do not represent NBA Finals appearances or results.",
  },
  golden_boot: {
    title: "Scoring Champion",
    shelfLabel: "SCORING CHAMP",
    metricLabel: "Elite Star Attraction",
    description:
      "A GitHoop shooting achievement, held on current form by players whose repositories keep attracting stars. Any position can earn it.",
  },
  world_cup: {
    title: "Championship",
    shelfLabel: "CHAMPION",
    metricLabel: "Sustained Excellence",
    description:
      "A GitHoop career achievement for an overall of 90 or more and at least three completed seasons with 2,000 contributions and a multi-signal season score of 19.5 or more. It does not claim a real-world championship.",
  },
};

// ---- The shared year score -------------------------------------------------
// Log multi-factor, same physics as the scoring engine's Lg() curves: each
// dimension saturates, so 20k commits barely outscore 2k and a spammer caps out
// on one axis while any real year collects across several. No hard balance
// gate — a commits-only kernel legend scores on volume axes alone.

const lg = (n: number) => Math.log10(1 + Math.max(0, n));

export const yearScore = (y: YearBreakdown): number =>
  4 * lg(y.commits) + 3 * lg(y.prs) + 3 * lg(y.reviews) + 2 * lg(y.issues) + 2 * lg(y.restricted);

const rawTotal = (y: YearBreakdown) => y.commits + y.prs + y.reviews + y.issues + y.restricted;

// Every award requires a real profile; a floor, never a driver (the rating is
// generous, so this only keeps genuinely thin cards off the podium).
const AWARD_OVR_FLOOR = 80;

// ---- MVP -----------------------------------------------------------
// A year wins when it clears the floor AND either stands out against the
// profile's own career median (the spike path — one great year in a modest
// career) or is elite in absolute terms (the legend path — a sustained-great
// career has a huge median no year can tower over, yet those years are exactly
// what the award exists for). Cap 3 (icons get a 4th — the 90s-are-earned tier
// already encodes "legend"), and repeats demand a stronger profile: each extra
// trophy needs a higher overall (BDO_OVR_LADDER). The current partial year
// competes as-is: it can only under-score, never over-score.

// Calibrated on real careers: torvalds' kernel years (commits-only, ~2.5k/yr +
// a few PRs) score ~17-20 and his best two clear the elite bar; a flat
// 20k-commits-only spam career scores ~17 per year and clears nothing.
const BDO_FLOOR = 16; // a genuinely strong year, in score terms
const BDO_MIN_RAW = 2000; // and in raw volume — no MVP under 2k contributions
const BDO_RATIO = 1.2; // spike path: 1.2× the career-median year
const BDO_ELITE = 19.5; // legend path: elite in absolute terms, ratio waived
const BDO_CAP = 3;
// Icons may take a 4th — but only for a monster year (score ≥ this), so the
// extra trophy stays exceptional instead of a routine icon perk.
const BDO_FOURTH = 28;
// Repeats demand a stronger profile: the n-th MVP needs the card's
// overall past the n-th floor — one at 80, a second at 87, a third (or an
// icon's 4th) at 94. First-win difficulty is untouched.
const BDO_OVR_LADDER = [AWARD_OVR_FLOOR, 87, 94, 94];

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

function seasonMvps(card: Card): AwardInstance[] {
  const years = card.years ?? [];
  if (card.overall < AWARD_OVR_FLOOR || years.length < 2) return [];

  const scored = years.map((y) => ({ y, score: yearScore(y) }));
  const mid = median(scored.map((s) => s.score));
  if (mid <= 0) return [];

  const qualifying = scored
    .filter(
      (s) =>
        rawTotal(s.y) >= BDO_MIN_RAW &&
        s.score >= BDO_FLOOR &&
        (s.score >= BDO_RATIO * mid || s.score >= BDO_ELITE),
    )
    .sort((a, b) => b.score - a.score);
  const icon = card.finish === "icon" || card.finish === "founder";
  const iconCap = icon && qualifying[BDO_CAP]?.score >= BDO_FOURTH ? BDO_CAP + 1 : BDO_CAP;
  const ovrCap = BDO_OVR_LADDER.filter((floor) => card.overall >= floor).length;
  // Reasons are factual and third-person (cards are mostly viewed by OTHERS),
  // and never claim a rank: rank comes from score, where breadth can beat raw
  // volume, and "career-best: 2,113" next to "#2: 3,928" reads as nonsense.
  return qualifying
    .slice(0, Math.min(iconCap, ovrCap))
    .sort((a, b) => a.y.year - b.y.year)
    .map(({ y, score }) => {
      const ratio = score / mid;
      const lead =
        ratio >= BDO_RATIO ? `${ratio.toFixed(1)}× the career-median season` : "An elite season";
      return {
        key: "ballon_dor" as const,
        year: y.year,
        reason: `${lead}: ${rawTotal(y).toLocaleString()} contributions, ${workKinds(y)}.`,
      };
    });
}

// "commits, PRs and reviews" — the kinds of work that made the year.
const workKinds = (y: YearBreakdown) => {
  const kinds = (
    [
      [y.commits, "commits"],
      [y.prs, "PRs"],
      [y.reviews, "reviews"],
      [y.issues, "issues"],
      [y.restricted, "private work"],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([, label]) => label);
  if (kinds.length === 1) return `all in ${kinds[0]}`;
  return `spread over ${kinds.slice(0, -1).join(", ")} and ${kinds[kinds.length - 1]}`;
};

// ---- Clutch Performer -------------------------------------------------
// One per completed June, using separately fetched contribution totals and the
// same year's daily pace. The window and threshold are GitHoop game mechanics.

export interface WcEdition {
  edition: string;
  year: number;
  from: string; // ISO datetime, June 1
  to: string; // ISO datetime, June 30
  span: string; // human dates for award copy
  days: number;
  /** Multiplier for the absolute score floor. */
  floorScale: number;
  /** Window daily pace must beat this × the same year's pace. 0 = no form gate. */
  formRatio: number;
}

// Kept under the original exported name for cache/caller compatibility. These
// are fixed June development sprints, not real tournament dates or results.
export const WC_EDITIONS: readonly WcEdition[] = Array.from(
  { length: Math.max(0, new Date().getUTCFullYear() - 2008 + 1) },
  (_, i) => {
    const year = 2008 + i;
    return {
      edition: `June ${year}`, year,
      from: `${year}-06-01T00:00:00Z`, to: `${year}-06-30T23:59:59Z`,
      span: `Jun 1 – Jun 30, ${year}`, days: 30, floorScale: 1, formRatio: 1.3,
    };
  },
);

// Minimum log-scaled contribution score for a June sprint.
const WC_BALL_FLOOR = 10;

/** Contribution totals inside one June window, keyed to its edition. */
export interface WcWindowTotals extends YearBreakdown {
  edition: string;
}

function clutchAwards(card: Card, windows: WcWindowTotals[], now: Date): AwardInstance[] {
  if (card.overall < AWARD_OVR_FLOOR) return [];
  const byYear = new Map((card.years ?? []).map((y) => [y.year, y]));

  return WC_EDITIONS.flatMap((ed) => {
    if (now.getTime() < Date.parse(ed.to)) return [];
    const win = windows.find((w) => w.edition === ed.edition);
    if (!win) return [];
    if (yearScore(win) < WC_BALL_FLOOR * ed.floorScale) return [];

    const winRaw = rawTotal(win);
    if (ed.formRatio > 0) {
      const yearRow = byYear.get(ed.year);
      if (!yearRow) return [];
      // The current year is partial — pace over its elapsed days, or a June
      // window would look like a hot streak against a full-year divisor.
      const yearDays =
        ed.year === now.getUTCFullYear()
          ? Math.max((now.getTime() - Date.UTC(ed.year, 0, 1)) / 86_400_000, ed.days)
          : (Date.UTC(ed.year + 1, 0, 1) - Date.UTC(ed.year, 0, 1)) / 86_400_000;
      const pace = winRaw / ed.days / (rawTotal(yearRow) / yearDays || 1);
      if (pace < ed.formRatio) return [];
      return [{
        key: "wc_golden_ball" as const,
        edition: ed.edition,
        reason: `${pace.toFixed(1)}× the usual pace during the June sprint (${ed.span}): ${winRaw.toLocaleString()} contributions in ${ed.days} days.`,
      }];
    }
    return [];
  });
}

// ---- Scoring Champion -----------------------------------------------------------
// Held on current form: elite shooting at any position. No year attached.

const BOOT_SHO_FLOOR = 80;

function scoringChampion(card: Card): AwardInstance[] {
  if (card.overall < AWARD_OVR_FLOOR) return [];
  if (card.stats.sho < BOOT_SHO_FLOOR) return [];
  return [{
    key: "golden_boot",
    reason: `On current form: SHO ${card.stats.sho} as a ${card.position}. The scoring title stays while the stars keep coming.`,
  }];
}

// ---- Championship -------------------------------------

function championship(card: Card, now: Date): AwardInstance[] {
  const seasons = (card.years ?? []).filter((y) =>
    y.year < now.getUTCFullYear() && rawTotal(y) >= BDO_MIN_RAW && yearScore(y) >= BDO_ELITE,
  );
  if (card.overall < 90 || seasons.length < 3) return [];
  return [{
    key: "world_cup",
    reason: `OVR ${card.overall} with ${seasons.length} completed elite seasons. Sustained contribution, collaboration and maintenance earned this GitHoop championship.`,
  }];
}

// ---- Cabinet ---------------------------------------------------------------

/**
 * The full cabinet for a card, in shelf order. `wcWindows` is the optional
 * June-window data (one extra query, candidates only) — without it the
 * Clutch Performer is simply not judged.
 */
export function computeAwards(card: Card, wcWindows: WcWindowTotals[] = [], now = new Date()): AwardInstance[] {
  return [
    ...championship(card, now),
    ...seasonMvps(card),
    ...clutchAwards(card, wcWindows, now),
    ...scoringChampion(card),
  ];
}

/** True when the June-window query is worth its cost for this card. */
export function wcBallCandidate(card: Card): boolean {
  if (card.overall < AWARD_OVR_FLOOR) return false;
  const years = card.years ?? [];
  return WC_EDITIONS.some((ed) => years.some((y) => y.year === ed.year && rawTotal(y) > 0));
}

/** Cabinet grouped for display: one shelf slot per award type, instances inside. */
export interface AwardGroup {
  key: AwardKey;
  instances: AwardInstance[];
}

const SHELF_ORDER: readonly AwardKey[] = ["world_cup", "ballon_dor", "wc_golden_ball", "golden_boot"];

export function groupAwards(awards: AwardInstance[] = []): AwardGroup[] {
  return SHELF_ORDER.flatMap((key) => {
    const instances = awards.filter((a) => a.key === key);
    return instances.length ? [{ key, instances }] : [];
  });
}
