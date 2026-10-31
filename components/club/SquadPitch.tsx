"use client";

import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { POSITION_NAMES, type Line } from "@/lib/lines";
import { LINES } from "@/lib/squad";
import type { Squad, SquadSlot } from "@/lib/scoring/club";
import { cardDisplayName } from "@/lib/text";
import { RESULT_THEME } from "../finishTheme";
import CourtMarkings, { COURT_POSITIONS } from "../squads/CourtMarkings";

function Chip({ slot, line }: { slot: SquadSlot; line: Line }) {
  const p = slot.player;
  const base = "flex w-[100px] max-w-[28%] flex-col items-center text-center";
  const avatar = "h-[clamp(38px,11vw,52px)] w-[clamp(38px,11vw,52px)]";
  if (!p) return <div className={base}>
    <span className={`font-display grid ${avatar} place-items-center rounded-full border border-dashed border-white/40 text-white/70`}>{line}</span>
    <span className="mt-2 text-[12px] text-white/75">Open</span>
  </div>;
  const theme = RESULT_THEME[p.finish];
  const title = slot.outOfPosition ? `${p.name}, a ${p.position} playing ${line}` : `${p.name}, ${p.position}`;
  return <Link href={`/${p.login}`} title={title} aria-label={`${title}, overall ${p.overall}`} className={`group ${base} rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}>
    <span className="relative">
      <span className={`block ${avatar} overflow-hidden rounded-full border-2 bg-black/30`} style={{ borderColor: theme.ink }}>
        <img src={p.avatarUrl} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} alt="" className="h-full w-full object-cover" />
      </span>
      <span className="font-display absolute -bottom-[5px] -right-[7px] min-w-[24px] rounded px-1 text-[14px] tabular-nums" style={{ background: theme.chip, color: theme.ink }}>{p.overall}</span>
    </span>
    <span className="mt-2 w-full truncate text-[12px] font-semibold text-white">{cardDisplayName(p.name)}</span>
    <span className="font-display mt-1 inline-flex items-center gap-1 text-[12px] text-white/75">{line}{slot.outOfPosition && <ArrowLeftRight size={11} aria-hidden />}</span>
  </Link>;
}

export default function SquadPitch({ squad }: { squad: Squad }) {
  return <div className="relative mx-auto aspect-[1.15] w-full max-w-[560px] overflow-hidden rounded-xl bg-[#694529]" aria-label="Basketball starting five">
    <CourtMarkings />
    {LINES.map((line) => <div key={line} className="absolute flex w-full -translate-x-1/2 -translate-y-1/2 justify-center" style={COURT_POSITIONS[line]}>
      <span className="sr-only">{POSITION_NAMES[line]}</span>
      <Chip slot={squad.lines[line][0]} line={line} />
    </div>)}
  </div>;
}
