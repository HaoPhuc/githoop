import Link from "next/link";
import { POSITION_NAMES } from "@/lib/lines";
import type { PlayerEntry } from "@/lib/registry";
import { LINES, QUOTA, type Squad } from "@/lib/squad";
import { Avatar } from "./Media";
import { Section } from "./Panels";

// The full fifteen by position, best-first, each line padded with open slots up to its
// quota so a short pool reads as "not enough players yet", not a smaller squad.

const TITLES = POSITION_NAMES;

function Row({ player, starter }: { player: PlayerEntry; starter: boolean }) {
  return (
    <li className="border-b border-white/[0.06] last:border-b-0">
      <Link href={`/${player.login}`} className="group flex items-center gap-[10px] py-[8px]">
        <Avatar src={player.avatarUrl} px={32} className="h-[32px] w-[32px]" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-[6px]">
            <span className="truncate text-[14px] font-semibold text-ink-dim transition group-hover:text-brand">
              {player.name || player.login}
            </span>
            {starter && (
              <span className="font-display flex-none rounded-[4px] bg-brand/15 px-[5px] text-[11px] leading-[1.4] tracking-[.12em] text-brand">
                Starter
              </span>
            )}
          </span>
          <span className="block truncate text-[12px] text-ink-mute">
            @{player.login}

          </span>
        </span>
        <span className="font-display w-[34px] flex-none text-right text-[13px] tracking-[.1em] text-ink-faint">
          {player.position}
        </span>
        <span className="font-display w-[30px] flex-none text-right text-[21px] leading-none tabular-nums text-ink">
          {player.overall}
        </span>
      </Link>
    </li>
  );
}

function OpenRow() {
  return (
    <li className="flex items-center gap-[10px] border-b border-white/[0.06] py-[8px] last:border-b-0">
      <span aria-hidden className="h-[32px] w-[32px] flex-none rounded-full border border-dashed border-white/20" />
      <span className="text-[13px] text-ink-mute">Open slot</span>
    </li>
  );
}

export default function SquadList({ squad }: { squad: Squad }) {
  const starters = new Set(LINES.flatMap((l) => squad.xi[l]));
  return (
    <div className="grid grid-cols-2 gap-[14px] max-[760px]:grid-cols-1">
      {LINES.map((line) => {
        const players = squad.lines[line];
        return (
          <Section key={line} title={TITLES[line]} aside={`${players.length}/${QUOTA[line]}`}>
            <ol>
              {players.map((p) => (
                <Row key={p.login} player={p} starter={starters.has(p)} />
              ))}
              {Array.from({ length: QUOTA[line] - players.length }, (_, i) => (
                <OpenRow key={i} />
              ))}
            </ol>
          </Section>
        );
      })}
    </div>
  );
}
