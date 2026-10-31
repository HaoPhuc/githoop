"use client";

import type { CSSProperties } from "react";
import type { StatKey } from "@/lib/scoring/types";
import type { Club } from "@/lib/scoring/club";
import { languageLogoUrl } from "@/lib/github/languages";
import { CARD_THEME } from "../finishTheme";

// A club on the player card's 540×820 frame (see PlayerCard, whose positions and
// sizes this mirrors): the tier art, the overall, the formation where a player
// shows the position, the location's flag, the headline language, the name and
// the six club stats. The org avatar sits in the portrait window as the crest,
// whole and unfeathered, since it's a logo rather than a photo.

const FONT_MEDIUM = "var(--font-din-medium), 'Saira Condensed', sans-serif";
const FONT_COND = "var(--font-din-cond), 'Saira Condensed', sans-serif";
const FONT_BOLD = "var(--font-din-bold), 'Saira Condensed', sans-serif";

const pad2 = (n: number) => String(Math.round(n)).padStart(2, "0");

const STAT_CELLS: { k: StatKey; l: string; vx: number; lx: number; vy: number; ly: number }[] = [
  { k: "ath", l: "ATH", vx: 21.3, lx: 32.41, vy: 64.63, ly: 65.24 },
  { k: "hnd", l: "HND", vx: 56.48, lx: 67.59, vy: 64.63, ly: 65.24 },
  { k: "sho", l: "SHO", vx: 21.3, lx: 32.41, vy: 72.2, ly: 72.8 },
  { k: "def", l: "DEF", vx: 56.48, lx: 67.59, vy: 72.2, ly: 72.8 },
  { k: "pas", l: "PAS", vx: 21.3, lx: 32.41, vy: 79.76, ly: 80.37 },
  { k: "reb", l: "REB", vx: 56.48, lx: 67.59, vy: 79.76, ly: 80.37 },
];

// [left%, top%, width%]
const H_LINES: [number, number, number][] = [
  [19.44, 31.1, 10.19], // under the formation
  [19.44, 40.85, 10.19], // under the flag
  [16.67, 64.02, 66.67], // under the name
  [44.44, 89.63, 11.11], // under the stats
];

const hideOnError: React.ReactEventHandler<HTMLImageElement> = (e) => {
  e.currentTarget.style.visibility = "hidden";
};

// A long display name falls back to the login, and anything still long shrinks
// to stay on one line between the card's edges.
function cardName(club: Club): { text: string; size: number } {
  const text = (club.name.length <= 14 ? club.name : club.login).toUpperCase();
  return { text, size: text.length <= 10 ? 13 : (13 * 10) / text.length };
}

export default function ClubCard({ club }: { club: Club }) {
  const t = CARD_THEME[club.finish];
  const ink = t.ink;
  const name = cardName(club);

  const at = (left: number, top: number): CSSProperties => ({ position: "absolute", left: `${left}%`, top: `${top}%` });

  return (
    <div
      role="img"
      aria-label={`${club.name}: ${club.overall} ${club.finishLabel} club, ${club.squad.formation}`}
      style={{
        containerType: "inline-size",
        position: "relative",
        width: "100%",
        aspectRatio: "540 / 820",
        filter: `drop-shadow(0 7cqw 10cqw rgba(0,0,0,.5)) drop-shadow(0 0 6cqw ${t.glow})`,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <img
        src={t.bg}
        alt=""
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill" }}
      />

      {/* the crest */}
      <img
        src={club.avatarUrl}
        onError={hideOnError}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          left: "38cqw",
          top: "22cqw",
          width: "46cqw",
          height: "46cqw",
          objectFit: "cover",
          borderRadius: "20%",
          filter: `drop-shadow(0 3cqw 6cqw rgba(0,0,0,.45)) drop-shadow(0 0 5cqw ${t.avatarHalo})`,
        }}
      />

      {H_LINES.map(([l, top, w], i) => (
        <div key={i} style={{ ...at(l, top), width: `${w}%`, height: "0.3cqw", background: ink, opacity: 0.5 }} />
      ))}
      <div style={{ ...at(50, 66.46), width: "0.3cqw", height: "20.12%", background: ink, opacity: 0.5 }} />

      <div
        style={{
          ...at(16.3, 9.76),
          fontFamily: FONT_MEDIUM,
          fontSize: "22.2cqw",
          fontWeight: 500,
          lineHeight: 1,
          color: ink,
        }}
      >
        {pad2(club.overall)}
      </div>

      {/* Basketball format where a player card shows its position. */}
      <div
        style={{
          ...at(25, 25.2),
          transform: "translateX(-50%)",
          fontFamily: FONT_COND,
          fontSize: "6.6cqw",
          fontWeight: 500,
          letterSpacing: ".02em",
          whiteSpace: "nowrap",
          color: ink,
        }}
      >
        {club.squad.formation}
      </div>

      {club.country && (
        <img
          src={`/badges/flags/${club.country}.png`}
          onError={hideOnError}
          alt={club.country}
          style={{ ...at(17.59, 33.17), width: "14.81%", height: "5.73%", objectFit: "contain" }}
        />
      )}

      {club.languageLogo && (
        <img
          src={languageLogoUrl(club.languageLogo.slug)}
          onError={hideOnError}
          alt={club.languageLogo.name}
          title={club.languageLogo.name}
          style={{ ...at(19.06, 42.25), width: "11.875%", height: "7.5%", objectFit: "contain" }}
        />
      )}

      <div
        style={{
          ...at(50, 53.66 + (13 - name.size) * 0.4),
          transform: "translateX(-50%)",
          fontFamily: FONT_BOLD,
          fontSize: `${name.size}cqw`,
          fontWeight: 700,
          whiteSpace: "nowrap",
          color: ink,
        }}
      >
        {name.text}
      </div>

      {STAT_CELLS.map((c) => (
        <div key={c.k}>
          <span
            style={{ ...at(c.vx, c.vy), fontFamily: FONT_BOLD, fontSize: "10.2cqw", fontWeight: 700, color: ink }}
          >
            {pad2(club.stats[c.k])}
          </span>
          <span
            style={{
              ...at(c.lx, c.ly),
              fontFamily: FONT_COND,
              fontSize: "9.3cqw",
              fontWeight: 500,
              letterSpacing: ".02em",
              color: ink,
            }}
          >
            {c.l}
          </span>
        </div>
      ))}
    </div>
  );
}
