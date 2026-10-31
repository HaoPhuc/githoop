import Link from "next/link";
import type { Card } from "@/lib/scoring/types";

// The quiet line under a card: which accounts it counts, or the way to merge one.
export default function MergeLine({ card }: { card: Card }) {
  const merged = card.mergedFrom ?? [];
  return (
    <p className="text-center text-[12px] text-ink-mute">
      {merged.length > 0 && <span>Includes {merged.map((l) => `@${l}`).join(", ")} · </span>}
      <Link
        href={`/merge?main=${encodeURIComponent(card.login)}`}
        className="font-semibold text-ink-soft underline-offset-2 transition hover:text-brand hover:underline"
      >
        {merged.length > 0 ? "manage merge ↗" : "got a second account? merge it ↗"}
      </Link>
    </p>
  );
}
