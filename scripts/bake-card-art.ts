// Bakes the Year Ring card art for each tier: the tier's body, the ball the avatar
// sits in, the baseline and the court behind the stats. The ring itself is drawn
// live over this art (lib/yearRing). Output: public/cards/<tier>.svg
//
// Usage:  npx tsx scripts/bake-card-art.ts
//
// Founders keep their own art and are not baked here.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BALL, BASELINE_Y } from "../lib/yearRing";

const OUT = join(process.cwd(), "public", "cards");

// rim, the card's body, and the pale line colour the court is drawn in.
const TIERS: Record<string, { rim: string; body: string; line: string }> = {
  bronze: { rim: "#4a2d1b", body: "#b57d53", line: "#f0cfa8" },
  silver: { rim: "#343e45", body: "#b7c2c9", line: "#edf3f6" },
  gold: { rim: "#544316", body: "#dcb957", line: "#ffe8a3" },
  "hot-streak": { rim: "#3c1912", body: "#df612c", line: "#ffb28b" },
  "all-star": { rim: "#10294d", body: "#3a77bd", line: "#b7d9ff" },
  "hall-of-fame": { rim: "#564522", body: "#eedcaf", line: "#fff2cf" },
};

const SEAM = "#221a15";
const BALL_FILL = "#f28a43";
const BALL_SHADE = "#d5652d";

// The site's basketball (public/basketball.svg), scaled onto the card.
function ball() {
  const { cx, cy, r } = BALL;
  const s = r / 106;
  return (
    `<g transform="translate(${cx - 120 * s} ${cy - 120 * s}) scale(${s})">` +
    `<circle cx="120" cy="120" r="106" fill="${BALL_FILL}"/>` +
    `<path d="M120 14a106 106 0 0 1 0 212c52-36 71-142 0-212Z" fill="${BALL_SHADE}"/>` +
    `<g fill="none" stroke="${SEAM}" stroke-width="6">` +
    `<circle cx="120" cy="120" r="106"/>` +
    `<path d="M14 120h212M120 14v212M45 45c98 3 148 62 150 150M45 195c3-98 62-148 150-150"/>` +
    `</g></g>`
  );
}

// A half court hanging off the baseline: the paint, the free-throw circle and the
// three-point arc, faint enough for the stats to sit on.
function court(line: string) {
  const y = BASELINE_Y;
  return (
    `<g fill="none" stroke="${line}" stroke-width="3" opacity=".3">` +
    `<path d="M190 ${y}V640H350V${y}"/>` +
    `<circle cx="270" cy="640" r="80"/>` +
    `<path d="M62 ${y}V520A208 208 0 0 0 478 520V${y}"/>` +
    `<path d="M22 750h496"/>` +
    `</g>`
  );
}

function art({ rim, body, line }: (typeof TIERS)[string]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="820" viewBox="0 0 540 820">
<rect x="8" y="8" width="524" height="804" rx="20" fill="${rim}"/>
<rect x="20" y="20" width="500" height="780" rx="12" fill="${body}"/>
<path d="M20 310 520 80V25H25V450Z" fill="${line}" opacity=".16"/>
<path d="m20 480 500-230v245L20 725Z" fill="${rim}" opacity=".12"/>
${court(line)}
<path d="M20 ${BASELINE_Y}h500" stroke="${line}" stroke-width="3" opacity=".65"/>
${ball()}
<path d="M20 738h500v50a12 12 0 0 1-12 12H32a12 12 0 0 1-12-12Z" fill="${rim}" opacity=".13"/>
<path d="M40 36h70v7H40Z" fill="${line}" opacity=".65"/>
</svg>
`;
}

for (const [name, tier] of Object.entries(TIERS)) writeFileSync(join(OUT, `${name}.svg`), art(tier));
console.log("baked", Object.keys(TIERS).length, "tiers");
