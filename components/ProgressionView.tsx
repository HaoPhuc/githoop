"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FINISH_LABELS, STAT_LABELS, STATS } from "@/lib/scoring/constants";
import { formatMoney } from "@/lib/format";
import type { Card, SeasonRating } from "@/lib/scoring/types";
import { resolveResultTheme } from "./finishTheme";

// The progression page: the season-by-season rating, how each stat moved since
// last season, and the potential/market-value outlook (lib/scoring/progression).

// Data marks use the brand's mid green on every tier: it clears the chart
// palette checks against the midnight surface (the pale tier inks are text inks).
const MARK = "#d9682e";
const UP = "#f28a43";
const DOWN = "#f85149";

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-[16px]">
      <div className="mb-[12px] flex items-center gap-[9px]">
        <span className="h-[2px] w-[16px] rounded-full" style={{ background: accent }} />
        <h2 className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-[16px] py-[14px] max-[620px]:px-[11px] max-[620px]:py-[11px]">
      <div className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint max-[620px]:tracking-[.12em]">
        {label}
      </div>
      <div
        className="font-display mt-[6px] text-[clamp(26px,7vw,40px)] leading-none tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </div>
      <div className="mt-[6px] text-[12.5px] leading-[1.35] text-ink-soft max-[620px]:text-[11.5px]">{note}</div>
    </div>
  );
}

const seasonLabel = (s: SeasonRating) => (s.current ? "Now" : String(s.year));

// Overall per season: one 2px line, 8px markers, values printed only on the
// first, peak and current seasons, and a tooltip on hover/tap for the rest.
function SeasonChart({ seasons }: { seasons: SeasonRating[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at the container's real pixel width, so the 12px labels stay 12px on
  // a phone instead of shrinking with a scaled viewBox.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(260, Math.max(200, W * 0.34)));
  const pad = { l: 34, r: 18, t: 30, b: 34 };
  const n = seasons.length;
  const values = seasons.map((s) => s.overall);
  const lo = Math.max(0, Math.floor((Math.min(...values) - 4) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...values) + 4) / 10) * 10);
  const step = hi - lo > 40 ? 20 : 10;
  const x = (i: number) => (n === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo);
  const ticks = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const peak = values.indexOf(Math.max(...values));
  const labelled = new Set([0, peak, n - 1]);
  // As many year labels as fit at ~46px apart, counted back from NOW.
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - pad.l - pad.r) / 46))));
  const showYear = (i: number) => (n - 1 - i) % every === 0;
  const line = seasons.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.overall).toFixed(1)}`).join(" ");
  const half = n > 1 ? (W - pad.l - pad.r) / (n - 1) / 2 : W / 2;
  const h = hover === null ? null : seasons[hover];

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block h-auto w-full"
        role="img"
        aria-label={`Overall rating by season, from ${values[0]} in ${seasonLabel(seasons[0])} to ${values[n - 1]} now.`}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
            <text x={pad.l - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#6e7681">
              {t}
            </text>
          </g>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t - 8} y2={H - pad.b} stroke="rgba(255,255,255,.18)" strokeWidth="1" />
        )}
        {n > 1 && <path d={line} fill="none" stroke={MARK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {seasons.map((s, i) => (
          <g key={s.year + (s.current ? "-now" : "")}>
            <circle
              cx={x(i)}
              cy={y(s.overall)}
              r={s.current ? 6 : 4}
              fill={MARK}
              stroke="#111111"
              strokeWidth="2"
            />
            {labelled.has(i) && (
              <text x={x(i)} y={y(s.overall) - 12} textAnchor="middle" fontSize="13" fontWeight="700" fill="#c9d1d9">
                {s.overall}
              </text>
            )}
            {showYear(i) && (
              <text
                x={x(i)}
                y={H - pad.b + 22}
                textAnchor="middle"
                fontSize="12"
                fill={s.current ? "#c9d1d9" : "#6e7681"}
                fontWeight={s.current ? 700 : 400}
              >
                {s.current ? "NOW" : s.year}
              </text>
            )}
            {/* hit target: the whole column, much wider than the marker */}
            <rect
              x={x(i) - half}
              y={0}
              width={half * 2}
              height={H}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onClick={() => setHover(i)}
            />
          </g>
        ))}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] whitespace-nowrap rounded-lg border border-line bg-panel px-[10px] py-[7px] text-[12.5px] shadow-[0_8px_24px_rgba(0,0,0,.45)]"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.overall) / H) * 100}%` }}
        >
          <div className="text-ink-faint">{h.current ? "This season" : `${h.year} season`}</div>
          <div className="mt-[2px] font-semibold text-ink">
            {h.overall} {h.position} · {FINISH_LABELS[h.finish]}
          </div>
        </div>
      )}
      <table className="sr-only">
        <caption>Overall rating by season</caption>
        <thead>
          <tr>
            <th>Season</th>
            <th>Overall</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((s) => (
            <tr key={s.year + (s.current ? "-now" : "")}>
              <td>{seasonLabel(s)}</td>
              <td>{s.overall}</td>
              <td>{s.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Each stat's bar is today's value; the tick marks last season's.
function StatProgress({ card, previous }: { card: Card; previous: SeasonRating | null }) {
  return (
    <div className="flex flex-col gap-[13px]">
      {STATS.map((k) => {
        const now = card.stats[k];
        const before = previous?.stats[k];
        const delta = before === undefined ? null : now - before;
        return (
          <div key={k}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[15px] tracking-[.08em] text-ink-dim">{STAT_LABELS[k]}</span>
              <span className="flex items-baseline gap-[8px]">
                {delta !== null && (
                  <span
                    className="text-[12px] font-semibold tabular-nums"
                    style={{ color: delta > 0 ? UP : delta < 0 ? DOWN : "#6e7681" }}
                  >
                    {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "= 0"}
                  </span>
                )}
                <span className="font-display text-[17px] leading-none tabular-nums text-ink">{now}</span>
              </span>
            </div>
            <div className="relative mt-[7px] h-[4px] rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full" style={{ width: `${now}%`, background: MARK }} />
              {before !== undefined && (
                <span
                  className="absolute top-1/2 h-[10px] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-soft"
                  style={{ left: `${before}%` }}
                  title={`${previous?.year}: ${before}`}
                />
              )}
            </div>
          </div>
        );
      })}
      <p className="text-[12px] text-ink-mute">
        {previous ? `Bar = now, tick = the ${previous.year} season.` : "No completed season to compare yet."}
      </p>
    </div>
  );
}

function Valuation({ card }: { card: Card }) {
  const o = card.outlook!;
  const gap = o.potential - card.overall;
  const rows: [string, string, string][] = [
    [`Overall ${card.overall}`, "base value", formatMoney(o.valueParts.base)],
    [gap > 0 ? `Potential +${gap}` : "Potential reached", "room to grow is priced in", `×${o.valueParts.potential.toFixed(2)}`],
    [`Age ${o.age}`, o.valueParts.age < 1 ? "past their prime years" : "no age discount yet", `×${o.valueParts.age.toFixed(2)}`],
  ];
  return (
    <div className="flex flex-col">
      {rows.map(([label, note, v]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] py-[9px]">
          <span>
            <span className="text-[14px] text-ink-dim">{label}</span>
            <span className="ml-[8px] text-[12px] text-ink-mute">{note}</span>
          </span>
          <span className="text-[14px] font-semibold tabular-nums text-ink">{v}</span>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-3 pt-[10px]">
        <span className="font-display text-[15px] tracking-[.08em] text-ink">MARKET VALUE</span>
        <span className="font-display text-[22px] tabular-nums text-ink">{formatMoney(o.value)}</span>
      </div>
      <p className="mt-[10px] text-[12.5px] leading-[1.5] text-ink-soft">
        Age is 17 plus years on GitHub. Younger accounts have more room to grow, and coding most days keeps
        it: this profile keeps {Math.round(o.drive * 100)}% of its room.
      </p>
    </div>
  );
}

export default function ProgressionView({ card }: { card: Card }) {
  const accent = resolveResultTheme(card).ink;
  const seasons = card.seasons ?? [];
  const previous = seasons.length > 1 ? seasons[seasons.length - 2] : null;
  const o = card.outlook;

  return (
    <main className="relative z-[2] mx-auto flex min-h-screen w-full max-w-[880px] flex-col gap-[14px] px-5 pb-12 pt-6">
      <Link
        href={`/${card.login}`}
        className="self-start text-[13px] font-semibold text-ink-soft transition hover:text-brand"
      >
        ← back to the card
      </Link>

      <header className="mt-2">
        <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">PROGRESSION</div>
        <h1 className="font-display mt-2 text-[clamp(34px,6vw,56px)] leading-[.95]">{card.name}</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          @{card.login} · {card.position} · {card.finishLabel}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-[14px] max-[620px]:gap-[8px]">
        <Tile label="OVERALL" value={String(card.overall)} note={`${card.finishLabel} · ${card.position}`} accent={accent} />
        {o ? (
          <>
            <Tile
              label="POTENTIAL"
              value={String(o.potential)}
              note={o.potential > card.overall ? `+${o.potential - card.overall} to grow · age ${o.age}` : `at their peak · age ${o.age}`}
              accent={accent}
            />
            <Tile label="VALUE" value={formatMoney(o.value)} note="fictional contract value" accent={accent} />
          </>
        ) : null}
      </div>

      <Section title="SEASON BY SEASON" accent={accent}>
        {seasons.length > 1 ? (
          <SeasonChart seasons={seasons} />
        ) : (
          <p className="py-2 text-[13.5px] text-ink-mute">
            Not enough history yet. The chart fills in after a full calendar year on GitHub.
          </p>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-[14px] max-[760px]:grid-cols-1">
        <Section title="STAT PROGRESSION" accent={accent}>
          <StatProgress card={card} previous={previous} />
        </Section>
        {o && (
          <Section title="HOW THE VALUE IS SET" accent={accent}>
            <Valuation card={card} />
          </Section>
        )}
      </div>

      <p className="text-[12px] leading-[1.5] text-ink-mute">
        Past seasons are rebuilt from each year&apos;s GitHub activity. GitHub keeps no history for stars,
        followers or languages, so every season uses today&apos;s values for those.
      </p>
    </main>
  );
}
