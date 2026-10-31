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
// the glow behind a club crest. `ring` is the palette for the player's Year Ring
// (lib/yearRing), and marks a ring card: circular avatar, ring over the art.
// Founder art has no ball, so founders leave it out and keep the feather.
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
    bg: "/cards/hoop-bronze.webp",
    ink: "#F2D6B3",
    glow: "rgba(207,154,103,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(42,23,13,.55))",
    avatarHalo: "rgba(207,154,103,.4)",
    ring: ["#22140B", "#58371F", "#885631", "#CF9A67", "#F2D6B3"],
  },
  silver: {
    bg: "/cards/hoop-silver.webp",
    ink: "#F4F1EC",
    glow: "rgba(207,203,196,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(31,28,25,.55))",
    avatarHalo: "rgba(207,203,196,.4)",
    ring: ["#22140B", "#534941", "#7F7871", "#CFCBC4", "#F4F1EC"],
  },
  gold: {
    bg: "/cards/hoop-gold.webp",
    ink: "#FFEDB0",
    glow: "rgba(242,203,87,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(58,42,8,.55))",
    avatarHalo: "rgba(242,203,87,.4)",
    ring: ["#22140B", "#6D5018", "#B08624", "#F2CB57", "#FFF0B5"],
  },
  totw: {
    bg: "/cards/hoop-totw.webp",
    ink: "#FFD2B0",
    glow: "rgba(255,106,43,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(61,14,5,.55))",
    avatarHalo: "rgba(255,106,43,.4)",
    ring: ["#22140B", "#74250F", "#BE3413", "#FF6A2B", "#FFD2B0"],
  },
  toty: {
    bg: "/cards/hoop-toty.webp",
    ink: "#FFF1D6",
    glow: "rgba(255,154,46,.55)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(154,74,11,.55))",
    avatarHalo: "rgba(255,154,46,.4)",
    ring: ["#22140B", "#81501E", "#D5862F", "#FFD08A", "#FFF1D6"],
  },
  icon: {
    bg: "/cards/hoop-icon.webp",
    ink: "#FFF0B5",
    glow: "rgba(255,224,138,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(18,10,4,.55))",
    avatarHalo: "rgba(255,224,138,.4)",
    ring: ["#22140B", "#745720", "#BE9333", "#FFE08A", "#FFFAE6"],
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

// CSS filter for a near-black language logo (isDarkLogo) on a dark ring card: flips
// it light and keeps its hues, so Rust turns white and Astro keeps its orange flame.
export const LIGHTEN_LOGO = "invert(1) hue-rotate(180deg)";

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
  totw: { glow: "rgba(255,106,43,.45)", chip: "#3D0E05", ink: "#FFD2B0" },
  toty: { glow: "rgba(255,154,46,.5)", chip: "#4A2307", ink: "#FFC878" },
  icon: { glow: "rgba(255,224,138,.45)", chip: "#1E1206", ink: "#F3D688" },
  founder: { glow: "rgba(255,47,69,.4)", chip: "#221016", ink: "#ff6273" },
};

// Per-card result accent: founders tint the whole scout report to their own
// accent (red for Younes, chrome for Mawsis); everyone else uses RESULT_THEME.
export function resolveResultTheme(card: Card): ResultTheme {
  const base = RESULT_THEME[card.finish];
  if (!card.founder) return base;
  return { ink: card.founder.accent, glow: rgba(card.founder.accent, 0.34), chip: base.chip };
}

// ---- Duel kit clash: ALL-STAR vs silver, and nothing else ----
// Those tiers' inks are both pale (toty #FFC878 vs silver #D6DCE6), so in that
// one matchup nothing side-coded on the Duel (names, bars, radars, scoreboard)
// says whose color is whose. The fix is surgical, only for this pairing: the
// ALL-STAR side swaps its pale ink for the tier's own saturated orange — the
// color its ring already wears — so it reads MORE toty, and silver stays silver.
// Every other matchup keeps its true tier inks.
const ALL_STAR_KIT: ResultTheme = { ink: "#FF9A2E", glow: RESULT_THEME.toty.glow, chip: RESULT_THEME.toty.chip };

export function duelThemes(challenger: Card, opponent: Card): { home: ResultTheme; away: ResultTheme } {
  const home = resolveResultTheme(challenger);
  const away = resolveResultTheme(opponent);
  if (challenger.finish === "toty" && opponent.finish === "silver") return { home: ALL_STAR_KIT, away };
  if (challenger.finish === "silver" && opponent.finish === "toty") return { home, away: ALL_STAR_KIT };
  return { home, away };
}

// Confetti palette per tier — gold for prestige, orange always woven in (brand).
// Founders burst in their own accent. Consumed by the card reveal (the Duel
// deliberately keeps its full time clean — no confetti).
const CONFETTI: Partial<Record<Finish, string[]>> = {
  toty: ["#e9cc74", "#d4af37", "#ff9a2e", "#ffffff", "#f28a43"],
  icon: ["#e9cc74", "#d4af37", "#f5f0e1", "#ffffff", "#f28a43"],
  totw: ["#f28a43", "#e9cc74", "#ffffff", "#ff6a2b"],
};

export function confettiPalette(card: Card): string[] {
  if (card.founder) return [card.founder.accent, "#ffffff", "#f28a43"];
  return CONFETTI[card.finish] ?? ["#f28a43", "#e9cc74", "#ffffff"];
}
