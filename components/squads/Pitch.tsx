import Link from "next/link";
import type { Line } from "@/lib/lines";
import { POSITION_NAMES } from "@/lib/lines";
import type { PlayerEntry } from "@/lib/registry";
import { LINES, shortName, type Squad } from "@/lib/squad";
import { Avatar } from "./Media";
import CourtMarkings, { COURT_POSITIONS } from "./CourtMarkings";

function Chip({ player, line }: { player?: PlayerEntry; line: Line }) {
  const face = "h-[clamp(40px,11vw,56px)] w-[clamp(40px,11vw,56px)]";
  const content = player ? <>
    <span className="relative">
      <Avatar src={player.avatarUrl} px={56} className={`${face} border-2 border-white/70 transition group-hover:border-brand`} />
      <span className="font-display absolute -bottom-[6px] left-1/2 -translate-x-1/2 rounded bg-bg px-[5px] text-[14px] tabular-nums text-gold-hi">{player.overall}</span>
    </span>
    <span className="mt-[10px] w-full truncate text-[12px] font-semibold text-white">{shortName(player)}</span>
    <span className="font-display text-[12px] text-white/75">{line}</span>
  </> : <>
    <span aria-hidden className={`${face} flex items-center justify-center rounded-full border-2 border-dashed border-white/40 text-white/70`}>+</span>
    <span className="mt-[10px] text-[12px] text-white/75">Open · {line}</span>
  </>;
  const className = "group flex w-[100px] max-w-[28%] flex-col items-center text-center";
  return player ? <Link href={`/${player.login}`} title={`${player.name || player.login} · ${player.overall} ${player.position}`} className={`${className} rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}>{content}</Link> : <div className={className}>{content}</div>;
}

export default function Pitch({ xi }: { xi: Squad["xi"] }) {
  return <div className="relative mx-auto aspect-[1.15] w-full max-w-[560px] overflow-hidden rounded-xl bg-[#694529]" aria-label="Basketball starting five">
    <CourtMarkings />
    {LINES.map((line) => <div key={line} className="absolute flex w-full -translate-x-1/2 -translate-y-1/2 justify-center" style={COURT_POSITIONS[line]}>
      <span className="sr-only">{POSITION_NAMES[line]}</span>
      <Chip player={xi[line][0]} line={line} />
    </div>)}
  </div>;
}
