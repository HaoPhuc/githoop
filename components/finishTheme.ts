import type { Card, Finish } from "@/lib/scoring/types";
import type { RingPalette } from "@/lib/yearRing";

// hex (#rgb / #rrggbb) → rgba() string, so a founder's single accent hex can
// drive translucent glows/tints without hand-writing each alpha variant.
export function rgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Each finish maps to its Year Ring art (public/cards, scripts/bake-card-art.ts),
// the text ink, a glow for the card's drop-shadow, and the avatar's treatment:
// avatarTint darkens the rim of the photo so it sits in the ball; avatarHalo is
// the glow behind a founder's feathered photo. `ring` is the palette for the
// player's Year Ring (lib/yearRing), printed from the card's body toward its ink
// so every tier keeps its own colours, and marks a card as a ring card: circular
// avatar, ring over the art. Founder art has no ball, so founders leave it out
// and keep the feather.
export interface CardTheme {
  bg: string;
  ink: string;
  glow: string;
  avatarTint: string;
  avatarHalo: string;
  ring?: RingPalette;
}

export const CARD_THEME: Record<Finish, CardTheme> = {
  bronze: {
    bg: "/cards/bronze.svg",
    ink: "#3a2717",
    glow: "rgba(190,120,60,.45)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(50,31,14,.45))",
    avatarHalo: "rgba(214,163,110,.4)",
    ring: ["#a9744d", "#906341", "#714e32", "#533823", "#3a2717"],
  },
  silver: {
    bg: "/cards/silver.svg",
    ink: "#303536",
    glow: "rgba(170,188,210,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(70,78,90,.45))",
    avatarHalo: "rgba(220,228,238,.4)",
    ring: ["#aab4ba", "#8f989d", "#6d7478", "#4b5153", "#303536"],
  },
  gold: {
    bg: "/cards/gold.svg",
    ink: "#46390c",
    glow: "rgba(225,185,80,.55)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(84,67,22,.45))",
    avatarHalo: "rgba(243,214,121,.45)",
    ring: ["#cdac50", "#af9341", "#8a732e", "#64531b", "#46390c"],
  },
  totw: {
    bg: "/cards/hot-streak.svg",
    ink: "#30180c",
    glow: "rgba(90,140,255,.55)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(60,25,18,.45))",
    avatarHalo: "rgba(127,168,255,.45)",
    ring: ["#ce5a29", "#ab4b22", "#7f391a", "#532712", "#30180c"],
  },
  toty: {
    bg: "/cards/all-star.svg",
    ink: "#ebcd5b",
    glow: "rgba(90,140,255,.55)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(14,35,80,.45))",
    avatarHalo: "rgba(127,168,255,.45)",
    ring: ["#4c80b3", "#6f91a0", "#9ba687", "#c8bc6f", "#ebcd5b"],
  },
  icon: {
    bg: "/cards/hall-of-fame.svg",
    ink: "#625217",
    glow: "rgba(243,213,128,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(86,69,34,.45))",
    avatarHalo: "rgba(243,214,136,.5)",
    ring: ["#e0cea0", "#c4b381", "#a1905b", "#7e6e35", "#625217"],
  },
  // Fallback only — real founder cards carry per-person art/accent via
  // resolveCardTheme(); this keeps the Record<Finish> map total.
  founder: {
    bg: "/cards/founder.svg",
    ink: "#f6f8fb",
    glow: "rgba(255,47,69,.55)",
    avatarTint: "radial-gradient(ellipse 72% 76% at 52% 40%, transparent 50%, rgba(0,0,0,.30))",
    avatarHalo: "rgba(255,47,69,.42)",
  },
};

// Per-card theme: identical to CARD_THEME for everyone except founders, who get
// their own art, a near-white ink, and a glow/halo derived from their accent.
export function resolveCardTheme(card: Card): CardTheme {
  const base = CARD_THEME[card.finish];
  if (!card.founder) return base;
  const a = card.founder.accent;
  return {
    bg: card.founder.art,
    ink: card.founder.ink ?? "#f6f8fb",
    glow: rgba(a, 0.55),
    avatarTint: "radial-gradient(ellipse 72% 76% at 52% 40%, transparent 50%, rgba(0,0,0,.30))",
    avatarHalo: rgba(a, 0.42),
  };
}

export interface ResultTheme {
  glow: string;
  chip: string;
  ink: string;
}

export const RESULT_THEME: Record<Finish, ResultTheme> = {
  bronze: { glow: "rgba(190,120,60,.34)", chip: "#2A1A0C", ink: "#F0CFA8" },
  silver: { glow: "rgba(170,188,210,.34)", chip: "#262B33", ink: "#D6DCE6" },
  gold: { glow: "rgba(225,185,80,.4)", chip: "#3A2806", ink: "#F3D679" },
  totw: { glow: "rgba(90,140,255,.5)", chip: "#10254F", ink: "#CADBFF" },
  toty: { glow: "rgba(90,140,255,.5)", chip: "#10254F", ink: "#CADBFF" },
  icon: { glow: "rgba(243,213,128,.45)", chip: "#2A1A45", ink: "#F3D688" },
  founder: { glow: "rgba(255,47,69,.4)", chip: "#221016", ink: "#ff6273" },
};

// Per-card result accent: founders tint the whole scout report to their own
// accent (red for Younes, chrome for Mawsis); everyone else uses RESULT_THEME.
export function resolveResultTheme(card: Card): ResultTheme {
  const base = RESULT_THEME[card.finish];
  if (!card.founder) return base;
  return { ink: card.founder.accent, glow: rgba(card.founder.accent, 0.34), chip: base.chip };
}

// ---- Duel kit clash: ALL-STAR/TOTW vs silver, and nothing else ----
// Those tiers' inks are near-twins (toty #CADBFF vs silver #D6DCE6), so in that
// one matchup nothing side-coded on the Duel (names, bars, radars, scoreboard)
// says whose color is whose. The fix is surgical, only for this pairing: the
// ALL-STAR/TOTW side swaps its pale ink for the tier's own saturated blue — the
// color its glow already wears — so it reads MORE toty, and silver stays
// silver. Every other matchup keeps its true tier inks.
const ALL_STAR_KIT: ResultTheme = { ink: "#7fa8ff", glow: RESULT_THEME.toty.glow, chip: RESULT_THEME.toty.chip };
const wearsTotyBlue = (f: Finish) => f === "toty" || f === "totw";

export function duelThemes(challenger: Card, opponent: Card): { home: ResultTheme; away: ResultTheme } {
  const home = resolveResultTheme(challenger);
  const away = resolveResultTheme(opponent);
  if (wearsTotyBlue(challenger.finish) && opponent.finish === "silver") return { home: ALL_STAR_KIT, away };
  if (challenger.finish === "silver" && wearsTotyBlue(opponent.finish)) return { home, away: ALL_STAR_KIT };
  return { home, away };
}

// Confetti palette per tier — gold for prestige, green always woven in (brand).
// Founders burst in their own accent. Consumed by the card reveal (the Duel
// deliberately keeps its full time clean — no confetti).
const CONFETTI: Partial<Record<Finish, string[]>> = {
  toty: ["#e9cc74", "#d4af37", "#7fa8ff", "#ffffff", "#f28a43"],
  icon: ["#e9cc74", "#d4af37", "#f5f0e1", "#ffffff", "#f28a43"],
  totw: ["#f28a43", "#e9cc74", "#ffffff", "#7fa8ff"],
};

export function confettiPalette(card: Card): string[] {
  if (card.founder) return [card.founder.accent, "#ffffff", "#f28a43"];
  return CONFETTI[card.finish] ?? ["#f28a43", "#e9cc74", "#ffffff"];
}
