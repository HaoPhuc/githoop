export type StatKey = "ath" | "sho" | "pas" | "hnd" | "def" | "reb";
export type Stats = Record<StatKey, number>;

export type Finish = "bronze" | "silver" | "gold" | "totw" | "toty" | "icon" | "founder";
export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type Family = "Playmaker" | "Shooter" | "RimProtector" | "Slasher" | "Allrounder";

export interface Signals {
  login: string;
  name: string;
  avatarUrl: string;
  location: string | null;
  followers: number;
  account_age_years: number;
  public_repos: number;
  total_stars_owned: number;
  max_repo_stars: number;
  languages: number; // count of distinct primary languages
  // Primary languages ranked by repo count (desc); rankedLanguages[0] is the
  // most-used. Optional so hand-authored sample Signals stay valid.
  rankedLanguages?: string[];
  topLanguage?: string | null;
  recent_contributions: number;
  active_days_recent: number;
  active_years: number;
  total_contributions_lifetime: number;
  prs_to_others: number;
  reviews: number;
  issues_closed: number;
  recent_commits: number;
  recent_spike: boolean;
  // Per-year history, oldest first. Optional: hand-authored sample Signals and
  // previously serialized data predate it.
  years?: YearBreakdown[];
  orgs?: string[]; // lowercase org logins they committed to this year, most commits first
  // Weekly contribution totals for the last 52 weeks, oldest first (Year Ring).
  // Optional for the same reason.
  recent_weeks?: number[];
}

// One calendar year of real contribution activity (from GitHub's per-year
// contributionsCollection windows). The substrate for yearly awards: fetched
// years may be missing (a window that failed its retry is omitted, not zeroed).
export interface YearBreakdown {
  year: number;
  commits: number;
  prs: number;
  reviews: number;
  issues: number;
  restricted: number; // private contributions (count only)
}

export type AwardKey = "ballon_dor" | "wc_golden_ball" | "golden_boot" | "world_cup";

// One earned trophy (see lib/awards for the rules). MVP instances carry the
// year; Clutch awards the edition; the reason is shown in the details modal.
export interface AwardInstance {
  key: AwardKey;
  year?: number;
  edition?: string;
  reason: string;
}

export type WorkRateLevel = "High" | "Med" | "Low";

export interface Playstyle {
  name: string;
  icon: string; // lucide icon key, resolved in the UI (keeps lib/ framework-agnostic)
  plus: boolean; // elite "PlayStyle+" tier
  reason: string; // short, plain why-it-was-given (tooltip)
}

export interface Metric {
  label: string;
  value: number; // real GitHub count
  unit?: string; // optional noun for the raw value, e.g. "stars"
  score: number; // 0–99 normalization of value
}

export interface Report {
  handles: number; // 1–5
  offHand: number; // 1–5
  workRate: { attack: WorkRateLevel; defense: WorkRateLevel };
  style: string;
  // short, plain explanations for the always-shown attributes (tooltips)
  reasons: { handles: string; offHand: string; workRate: string; style: string };
  playstyles: Playstyle[];
  metrics: Metric[];
}

export interface Archetype {
  name: string;
  blurb: string;
}

// A githoop founder's bespoke card treatment. Declared once (lib/scoring/constants
// FOUNDERS), resolved inside buildCard, and read by every surface (card art +
// accent, scout pill, OG accent) so the whole app tints to the right founder.
export interface FounderMeta {
  art: string; // root-relative card PNG, e.g. "/cards/founder-red.png"
  accent: string; // hex; drives the badge, pill, glow and OG accent
  ink?: string; // optional card text color override (defaults to near-white)
  label: string; // badge/pill text, e.g. "FOUNDER"
  tagline: string; // tooltip + flavor, e.g. "Co-founder of githoop"
}

// One point on the progression chart: a completed calendar year rebuilt from the
// yearly GitHub history (lib/scoring/progression), or the live card (current).
export interface SeasonRating {
  year: number;
  current: boolean;
  overall: number;
  position: Position;
  finish: Finish;
  stats: Stats;
}

// Potential and estimated fictional trade value (lib/scoring/progression).
export interface Outlook {
  age: number; // "player age": K.outlook.startAge + years on GitHub
  potential: number; // projected peak overall, >= overall
  drive: number; // 0–1: how much of the growth room the coding habit keeps
  value: number; // estimated fictional trade value, in dollars
  valueParts: { base: number; potential: number; age: number }; // base $ × the two multipliers
}

export interface Card {
  login: string;
  name: string;
  avatarUrl: string;
  // country & club are asset keys (public/badges/...), defaulted now and meant
  // to be user-editable later.
  country: string;
  club: string;
  stats: Stats;
  position: Position;
  family: Family;
  baseOVR: number;
  overall: number;
  finish: Finish;
  finishLabel: string;
  archetype: string;
  archetypeBlurb: string;
  legacy: { L: number };
  // Most-used language (by repo count) and its resolved catalog logo. topLanguage
  // is their true #1 even when it has no logo; languageLogo is the first ranked
  // language that does (the fallback walk), or null if none are in the catalog.
  // Both optional so previously serialized cards (localStorage) stay valid.
  topLanguage?: string | null;
  languageLogo?: { name: string; slug: string } | null;
  // Set only for githoop founders — their bespoke card art/accent + hint metadata.
  // Optional so every other card (and previously serialized ones) stay valid.
  founder?: FounderMeta;
  // Per-year history behind the yearly awards (MVP etc.). Optional so
  // cached/serialized cards from before the awards system stay valid.
  years?: YearBreakdown[];
  // Last 52 weeks of contributions, oldest first: the rays of the card's Year Ring
  // (lib/yearRing). Optional for the same serialization reason.
  weeks?: number[];
  // The trophy cabinet, computed at scout time (lib/awards via lib/scout).
  // Optional for the same serialization reason.
  awards?: AwardInstance[];
  // Season-by-season ratings (oldest first, ending with the live card) and the
  // potential/value outlook. Optional for the same serialization reason.
  seasons?: SeasonRating[];
  outlook?: Outlook;
  // ISO time the card was built from GitHub (lib/scout), behind the "Scouted …
  // ago · Re-scout" line. Unset on the baked sample cards.
  builtAt?: string;
  // Capture date for bundled examples, distinct from a live scout timestamp.
  sampledAt?: string;
  // Orgs they committed to this year (see Signals), behind team chemistry.
  // Optional so previously serialized cards stay valid.
  orgs?: string[];
  // Other accounts this card counts, when the player merged them (lib/merge).
  mergedFrom?: string[];
  report: Report;
}
