// Bakes the Year Ring card art for each finish: the dome, the ball's seams, the
// disc, the jaw and the rim. The ring itself is drawn live over this art
// (lib/yearRing). Output:
//   public/cards/hoop-<finish>.webp  — the live card
//   public/cards/hoop-<finish>.png   — the server-drawn PNGs (Satori can't decode webp)
//
// Usage:  npx tsx scripts/bake-card-art.ts
//
// The dome is one big basketball with the player at its centre, and every finish
// sits on a warm black so the metals stay in the wolf's family.
import { join } from "node:path";
import sharp from "sharp";
import { JAW_LINE, DISC } from "../lib/yearRing";

const BLACK = "#0D0805";
const OUT = join(process.cwd(), "public", "cards");

// m body, h highlight, p pale; body is the card's own warm black.
const FINISHES: Record<string, { m: string; h: string; p: string; body: string }> = {
  bronze: { m: "#9A6238", h: "#CF9A67", p: "#F2D6B3", body: "#2A170D" },
  silver: { m: "#8F8A83", h: "#CFCBC4", p: "#F4F1EC", body: "#1F1C19" },
  gold: { m: "#C99A28", h: "#F2CB57", p: "#FFF0B5", body: "#3A2A08" },
  totw: { m: "#D93A14", h: "#FF6A2B", p: "#FFD2B0", body: "#3D0E05" },
  toty: { m: "#F59A35", h: "#FFD08A", p: "#FFF1D6", body: "#9A4A0B" },
  icon: { m: "#D9A93A", h: "#FFE08A", p: "#FFFAE6", body: "#120A04" },
};

const DOME = "M22 134A323 323 0 0 1 518 134V664Q518 700 484 716L270 806L56 716Q22 700 22 664Z";
const JAW = `${JAW_LINE}V820H0Z`;
const WOLF_HEAD = "M150 58L180 52L214 8L232 14L250 86L280 150L262 176L258 250L206 316L150 336L94 316L42 250L38 176L20 150L50 86L68 14L86 8L120 52Z";

const channels = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const B = channels(b);
  return `#${channels(a)
    .map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0"))
    .join("")}`;
};

const wolfStamp = (fill: string, ball: string) =>
  `<g transform="translate(270 764) scale(.14) translate(-150 -172)"><path d="${WOLF_HEAD}" fill="${fill}"/><circle cx="150" cy="238" r="84" fill="${BLACK}"/><circle cx="150" cy="238" r="68" fill="${ball}"/><path d="M82 238H218M150 170V306" stroke="${BLACK}" stroke-width="12"/><path d="M66 140H234V176L196 196L150 178L104 196L66 176Z" fill="${fill}"/><ellipse cx="197" cy="112" rx="24" ry="28" fill="${BLACK}"/><ellipse cx="103" cy="112" rx="24" ry="28" fill="${BLACK}"/><path d="M126 136H174L150 164Z" fill="${BLACK}"/></g>`;

const star = (x: number, y: number, r: number, fill: string) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const q = i % 2 ? r * 0.42 : r;
    return `${i ? "L" : "M"}${(x + q * Math.cos(a)).toFixed(1)} ${(y + q * Math.sin(a)).toFixed(1)}`;
  });
  return `<path d="${points.join("")}Z" fill="${fill}"/>`;
};

// The faint contribution board the stats sit on.
function boardCells() {
  const size = 11;
  const corner = (r: number) =>
    `h${size - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${size - 2 * r}a${r} ${r} 0 0 1-${r} ${r}h-${size - 2 * r}a${r} ${r} 0 0 1-${r}-${r}v-${size - 2 * r}a${r} ${r} 0 0 1 ${r}-${r}z`;
  let d = "";
  for (let y = 1.5 + 28 * 14; y < 820; y += 14) {
    for (let x = 1.5; x < 540; x += 14) d += `M${x + 3} ${y}${corner(3)}`;
  }
  return d;
}

// The dome as a basketball: a cross through the player and two curved side seams.
function seams() {
  const { cx, cy } = DISC;
  return `M0 ${cy}H540M${cx} 0V444M78 0C214 112 214 332 78 444M596 0C460 112 460 332 596 444`;
}

function art(key: string) {
  const f = FINISHES[key];
  const edge = key === "toty" ? FINISHES.gold : f; // All-Star: an orange ball with a gold rim
  const { cx, cy, r } = DISC;
  const lit = key === "toty" ? { at: 0.92, fade: 0.22 } : { at: 0.62, fade: 0.55 }; // All-Star's whole dome is the ball
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1640" viewBox="0 0 540 820"><defs>
<clipPath id="s"><path d="${DOME}"/></clipPath>
<clipPath id="jc"><path d="${JAW}"/></clipPath>
<radialGradient id="b" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="430"><stop offset="0" stop-color="${f.body}"/><stop offset="${lit.at}" stop-color="${mix(f.body, BLACK, lit.fade)}"/><stop offset="1" stop-color="${BLACK}"/></radialGradient>
<radialGradient id="d" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${mix(f.body, "#FFFFFF", 0.1)}"/><stop offset="1" stop-color="${mix(f.body, BLACK, 0.4)}"/></radialGradient>
<linearGradient id="e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${edge.p}"/><stop offset=".4" stop-color="${edge.h}"/><stop offset=".7" stop-color="${edge.m}"/><stop offset="1" stop-color="${edge.h}"/></linearGradient>
<filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="20"/></filter>
</defs>
<g clip-path="url(#s)">
<rect width="540" height="820" fill="url(#b)"/>
<path d="${seams()}" fill="none" stroke="${BLACK}" stroke-opacity=".55" stroke-width="7"/>
<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="${f.h}" opacity=".45" filter="url(#g)"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#d)"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${edge.h}" stroke-width="5"/>
<path d="${JAW}" fill="${BLACK}"/>
<g clip-path="url(#jc)"><path d="${boardCells()}" fill="#1A1009"/></g>
<path d="${JAW_LINE}" fill="none" stroke="${edge.h}" stroke-width="2.4" stroke-linejoin="round"/>
${wolfStamp(edge.h, f.m)}
${key === "icon" ? star(236, 52, 9, f.h) + star(270, 42, 12, f.p) + star(304, 52, 9, f.h) : ""}
</g>
<path d="${DOME}" fill="none" stroke="url(#e)" stroke-width="7" stroke-linejoin="round"/>
<path d="${DOME}" fill="none" transform="translate(270 410) scale(.962) translate(-270 -410)" stroke="${edge.h}" stroke-opacity=".4" stroke-width="1.4"/>
</svg>`;
}

async function main() {
  for (const key of Object.keys(FINISHES)) {
    const image = sharp(Buffer.from(art(key)));
    await image.clone().png({ compressionLevel: 9, palette: false }).toFile(join(OUT, `hoop-${key}.png`));
    await image.clone().webp({ quality: 90, alphaQuality: 100 }).toFile(join(OUT, `hoop-${key}.webp`));
  }
  console.log("baked", Object.keys(FINISHES).length, "finishes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
