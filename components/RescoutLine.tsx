"use client";

import { useEffect, useState } from "react";
import { Clock, RotateCw } from "lucide-react";
import { canRescout, scoutedAgo } from "@/lib/rescout";
import type { Card } from "@/lib/scoring/types";

// "Scouted 47 min ago · Re-scout": how old the cached card is, and a way to
// rebuild it now (POST /api/rescout). The link hides for the cooldown after a
// build, matching the server lock; a held lock still answers with the wait.
type Status = { kind: "idle" } | { kind: "busy" } | { kind: "note"; text: string };

export default function RescoutLine({ card, onRescouted }: { card: Card; onRescouted: (card: Card) => void }) {
  // The clock starts after mount: rendering a relative time on the server would
  // disagree with the client's clock and trip a hydration mismatch.
  const [now, setNow] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (card.sampledAt) {
    return <p className="text-center text-[12px] text-ink-soft">Sample snapshot · {card.sampledAt.slice(0, 10)} · not live data</p>;
  }
  if (!card.builtAt || now === null) return null;
  const builtAt = card.builtAt;

  const rescout = async () => {
    setStatus({ kind: "busy" });
    try {
      const res = await fetch(`/api/rescout/${encodeURIComponent(card.login)}`, { method: "POST" });
      const data = await res.json();
      if (res.status === 429 && typeof data.retryAfter === "number") {
        const minutes = Math.ceil(data.retryAfter / 60);
        setStatus({ kind: "note", text: `Re-scouted recently. Try again in ${minutes} min.` });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Couldn't re-scout right now.");
      setStatus({ kind: "idle" });
      setNow(Date.now());
      onRescouted(data as Card);
    } catch (e) {
      setStatus({ kind: "note", text: (e as Error).message });
    }
  };

  return (
    <p className="flex flex-wrap items-center justify-center gap-x-[6px] gap-y-[2px] text-[12px] text-ink-mute">
      <Clock size={12} aria-hidden />
      {status.kind === "busy" ? (
        <span className="flex items-center gap-[6px]">
          <RotateCw size={12} className="animate-spin" aria-hidden />
          Re-scouting…
        </span>
      ) : (
        <>
          <span>Scouted {scoutedAgo(builtAt, now)}</span>
          {canRescout(builtAt, now) && status.kind === "idle" && (
            <>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={rescout}
                className="flex cursor-pointer items-center gap-[4px] font-semibold text-ink-soft underline-offset-2 transition hover:text-brand hover:underline"
              >
                <RotateCw size={12} aria-hidden />
                Re-scout
              </button>
            </>
          )}
          {status.kind === "note" && <span className="basis-full text-center">{status.text}</span>}
        </>
      )}
    </p>
  );
}
