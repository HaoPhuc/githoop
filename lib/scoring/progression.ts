import { K } from "./constants";
import type { Outlook, Signals, YearBreakdown } from "./types";

// Season history and the potential/value outlook. Pure: no I/O, no rating — the
// engine rates the rebuilt signals, so a season is scored exactly like a card.

const YEAR_MS = 31557600000;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const total = (y: YearBreakdown) => y.commits + y.prs + y.reviews + y.issues + y.restricted;

// §1 — the signals as they stood at the end of each completed calendar year,
// rebuilt from the per-year history. That year's activity drives ATH, the PR half
// of PAS, DEF and REB; GitHub keeps no history for stars, followers or languages,
// so those stay at today's values. The current, partial year is left to the live
// card, and years before the first contribution are skipped.
export function seasonSignals(s: Signals, now: Date): { year: number; signals: Signals }[] {
  const thisYear = now.getUTCFullYear();
  const years = (s.years ?? []).filter((y) => y.year < thisYear).sort((a, b) => a.year - b.year);
  let lifetime = 0;
  let activeYears = 0;
  return years.flatMap((y) => {
    const contributions = total(y);
    lifetime += contributions;
    if (contributions > 0) activeYears++;
    const age = s.account_age_years - (now.getTime() - Date.UTC(y.year + 1, 0, 1)) / YEAR_MS;
    if (lifetime === 0 || age <= 0) return [];
    const active = clamp(activeYears, 1, Math.max(s.active_years, 1));
    const signals: Signals = {
      ...s,
      account_age_years: age,
      recent_contributions: contributions,
      recent_commits: y.commits + y.restricted,
      prs_to_others: y.prs,
      reviews: y.reviews,
      issues_closed: y.issues,
      total_contributions_lifetime: lifetime,
      active_years: active,
      active_days_recent: 0, // no per-year calendar; it only feeds style/playstyles
      recent_spike: contributions > 2 * (lifetime / active),
      years: undefined,
    };
    return [{ year: y.year, signals }];
  });
}

// §2 — potential and fictional trade value. A GitHub account ages like a basketball player:
// young ones have room to grow, and the room they keep depends on how often they
// code. Value prices in the overall, the unrealised potential and the age.
export function outlook(s: Signals, overall: number): Outlook {
  const o = K.outlook;
  const age = Math.floor(o.startAge + s.account_age_years);
  const room = clamp((o.peakAge - age) * o.roomPerYear, 0, o.maxRoom);
  const drive = o.baseDrive + (1 - o.baseDrive) * clamp(s.active_days_recent / o.dailyDays, 0, 1);
  const potential = clamp(overall + Math.round(room * drive), overall, 99);

  const base = o.valueMax / (1 + Math.exp(-o.valueSteep * (overall - o.valueMid)));
  const potentialX = Math.exp(o.perPotential * (potential - overall));
  const ageX = age <= o.declineFrom ? 1 : Math.max(o.valueFloor, 1 - o.declinePerYear * (age - o.declineFrom));
  return {
    age,
    potential,
    drive,
    value: roundValue(base * potentialX * ageX),
    valueParts: { base: roundValue(base), potential: potentialX, age: ageX },
  };
}

// Two significant figures, like a fictional trade value: 47,316,200 → 47,000,000.
function roundValue(v: number): number {
  if (v < 1000) return Math.round(v);
  const unit = 10 ** (Math.floor(Math.log10(v)) - 1);
  return Math.round(v / unit) * unit;
}
