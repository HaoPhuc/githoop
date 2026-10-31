import type { Finish } from "@/lib/scoring/types";

// The Year Ring: a player's last 52 weeks wrapped around the ball on their card,
// seven cells deep, so a busy week is a long ray and every card burns with its own
// year. Plain strings with no React, so the live card and the server-drawn PNGs
// show the same image (PlayerCard, ClubCard, lib/og/renderCard).

export const WEEKS = 52;
const DEPTH = 7;
const PITCH = 13.5; // radial distance between cells
const LENGTH = 10.5; // cell size along the ray
const WIDTH = 13; // cell size across the ray at the ball; rays taper outward
const TAPER = 0.9;

// [unlit, faint, mid, bright, hottest]. Rays run hottest next to the ball.
export type RingPalette = [string, string, string, string, string];

// The disc at the middle of the ball on the card's 540×820 frame.
// scripts/bake-card-art.ts draws it from the same numbers; the ring and the avatar
// only have to line up with it.
export const DISC = { cx: 337, cy: 262, r: 130, avatarR: 127 };
const RING_START = DISC.r + 14;

// The avatar's circle inside the disc, in cqw (1% of the card's width).
export const AVATAR_CQW = {
  left: (DISC.cx - DISC.avatarR) / 5.4,
  top: (DISC.cy - DISC.avatarR) / 5.4,
  size: DISC.avatarR / 2.7,
};

// The wolf's jaw biting into the ball: ten teeth, two of them canines.
const JAW_Y = 444;
const jawPoints = (y: number) =>
  Array.from({ length: 21 }, (_, i) => [i * 27, i % 2 === 0 ? y : y - (i === 5 || i === 15 ? 35 : 20)]);
const line = (points: number[][]) => points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");
export const JAW_LINE = line(jawPoints(JAW_Y));

// Everything above the jaw, inside the card's rim.
const RING_CLIP = `M26 134A319 319 0 0 1 514 134V${JAW_Y - 2}${line(jawPoints(JAW_Y - 2).slice(1, -1).reverse()).replace("M", "L")}Z`;

// The rating, position and flag sit here, so the ring stays quiet behind them.
const behindRating = (x: number, y: number) => x < 226 && y > 60;

// A rounded cell is a quad with a thin round-joined stroke (see yearRingUri),
// which keeps the image small enough to hand around as a data URI.
function cellAt(week: number, depth: number) {
  const a = -Math.PI / 2 + ((week + 0.5) / WEEKS) * Math.PI * 2;
  const r = RING_START + depth * PITCH;
  const [x, y] = [DISC.cx + r * Math.cos(a), DISC.cy + r * Math.sin(a)];
  const [ux, uy] = [Math.cos(a) * (LENGTH / 2 - 1), Math.sin(a) * (LENGTH / 2 - 1)];
  const across = (WIDTH - depth * TAPER) / 2 - 1;
  const [vx, vy] = [-Math.sin(a) * across, Math.cos(a) * across];
  const corners = [
    [x - ux - vx, y - uy - vy],
    [x - ux + vx, y - uy + vy],
    [x + ux + vx, y + uy + vy],
    [x + ux - vx, y + uy - vy],
  ];
  const d = corners.map(([cx, cy], i) => `${i ? "L" : "M"}${cx.toFixed(1)} ${cy.toFixed(1)}`).join("");
  return { d: `${d}Z`, quiet: behindRating(x, y) };
}

const CELLS = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: DEPTH }, (_, k) => cellAt(w, k)));

// A day-by-day contribution calendar -> 52 weekly totals, oldest first. Weeks are
// counted back from today so the newest one is whole, and a calendar that runs
// short (a new account, a failed window) pads with empty weeks at the old end.
export function weeklyTotals(days: number[]): number[] {
  const out = new Array<number>(WEEKS).fill(0);
  const year = days.slice(-WEEKS * 7);
  const pad = WEEKS * 7 - year.length;
  year.forEach((n, i) => {
    out[Math.floor((i + pad) / 7)] += n;
  });
  return out;
}

// Lit cells for a week. Each extra cell takes twice the work, the same reasoning
// as the awards' logs: a bot's 5,000-commit week can't outshine a full ring, and
// any activity at all shows up. 64+ contributions fills the ray.
export const weekCells = (count: number) => Math.min(DEPTH, Math.ceil(Math.log2(Math.max(0, count) + 1)));

// Cards with no calendar (clubs, the baked samples, cards saved before the ring
// existed) get an even ring sized by finish: a clean pattern, not made-up data.
const EVEN_CELLS: Record<Finish, number> = { bronze: 2, silver: 3, gold: 4, totw: 5, toty: 6, icon: 7, founder: 7 };
export const evenWeeks = (finish: Finish) => new Array<number>(WEEKS).fill(2 ** EVEN_CELLS[finish] - 1);

// The ring as an image the size of the card, to lay over the art.
export function yearRingUri(weeks: number[], palette: RingPalette): string {
  const paths = palette.map(() => "");
  CELLS.forEach((week, w) => {
    const lit = weekCells(weeks[w] ?? 0);
    week.forEach(({ d, quiet }, k) => {
      const level = k >= lit ? 0 : k < 3 ? 4 : k < 5 ? 3 : 2;
      paths[quiet ? Math.min(level, 1) : level] += d;
    });
  });
  const body = paths.map((d, i) => (d ? `<path d="${d}" fill="${palette[i]}" stroke="${palette[i]}"/>` : "")).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="820" viewBox="0 0 540 820">` +
    `<defs><clipPath id="r"><path d="${RING_CLIP}"/></clipPath></defs>` +
    `<g clip-path="url(#r)" stroke-width="2" stroke-linejoin="round">${body}</g></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
