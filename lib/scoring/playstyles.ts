import { formatCount } from "../format";
import type { Playstyle, Signals } from "./types";

// A predefined catalog of GitHub "playstyles". Each fires when its real signal
// crosses `base`; `plus` marks the elite "Hall of Fame badge" tier. A weak/empty profile
// crosses none, so it shows few or no playstyles — strength drives the count.
// `noun` builds the tooltip reason, e.g. "248k stars earned".
interface PlaystyleDef {
  name: string;
  icon: string; // lucide icon key, resolved in the UI
  noun: string;
  value: (s: Signals) => number;
  base: number;
  plus: number;
}

const CATALOG: PlaystyleDef[] = [
  { name: "Limitless Range", icon: "star", noun: "stars earned", value: (s) => s.total_stars_owned, base: 500, plus: 20_000 },
  { name: "Catch and Shoot", icon: "flame", noun: "stars on one repo", value: (s) => s.max_repo_stars, base: 1_000, plus: 20_000 },
  { name: "Hustle", icon: "zap", noun: "active days this year", value: (s) => s.active_days_recent, base: 120, plus: 250 },
  { name: "Fast Break", icon: "fast-forward", noun: "contributions this year", value: (s) => s.recent_contributions, base: 500, plus: 2_500 },
  { name: "Glass Cleaner", icon: "infinity", noun: "lifetime contributions", value: (s) => s.total_contributions_lifetime, base: 3_000, plus: 25_000 },
  { name: "Clamps", icon: "shield", noun: "reviews & issues", value: (s) => s.reviews + s.issues_closed, base: 30, plus: 300 },
  { name: "Dimer", icon: "git-pull-request", noun: "pull requests", value: (s) => s.prs_to_others, base: 30, plus: 400 },
  { name: "Floor General", icon: "users", noun: "followers", value: (s) => s.followers, base: 200, plus: 20_000 },
  { name: "Ankle Breaker", icon: "languages", noun: "languages", value: (s) => s.languages, base: 5, plus: 9 },
  { name: "Volume Shooter", icon: "folder-git", noun: "public repos", value: (s) => s.public_repos, base: 30, plus: 150 },
  { name: "Veteran", icon: "clock", noun: "years on GitHub", value: (s) => s.account_age_years, base: 5, plus: 12 },
];

const MAX_SHOWN = 8;

// Returns the qualifying playstyles, Hall of Fame badge first, then by how strongly the
// profile clears each base threshold; capped so the list stays readable.
export function derivePlaystyles(s: Signals): Playstyle[] {
  return CATALOG.map((def) => ({ def, val: def.value(s) }))
    .filter(({ def, val }) => val >= def.base)
    .sort((a, b) => {
      const ap = a.val >= a.def.plus;
      const bp = b.val >= b.def.plus;
      if (ap !== bp) return ap ? -1 : 1;
      return b.val / b.def.base - a.val / a.def.base;
    })
    .slice(0, MAX_SHOWN)
    .map(({ def, val }) => ({
      name: def.name,
      icon: def.icon,
      plus: val >= def.plus,
      reason: `${formatCount(val)} ${def.noun}${val >= def.plus ? " — elite tier" : ""}.`,
    }));
}
