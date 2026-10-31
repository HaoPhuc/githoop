import Link from "next/link";
import { Trophy } from "lucide-react";
import { boardHref, formatRank, type BoardRank } from "@/lib/leaderboard";

// "Ranked #12 of 340 · leaderboard ↗": the card's world rank under the Scouting
// Metrics, styled like the RescoutLine above it, linking to the card's
// highlighted row on the board.
export default function RankLine({ login, rank }: { login: string; rank: BoardRank }) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-[6px] gap-y-[2px] text-[12px] text-ink-mute">
      <Trophy size={12} aria-hidden />
      <span>
        Ranked #{formatRank(rank.rank)} of {formatRank(rank.total)}
      </span>
      <span aria-hidden>·</span>
      <Link
        href={boardHref({ player: login })}
        className="font-semibold text-ink-soft underline-offset-2 transition hover:text-brand hover:underline"
      >
        leaderboard ↗
      </Link>
    </p>
  );
}
