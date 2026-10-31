"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { boardHref, parsePlayer } from "@/lib/leaderboard";
import { featuredFirst } from "@/lib/nations";

// Featured basketball nations first, as in the flag picker: the national team
// you're looking for is at the top instead of 200 countries down. Computed once,
// it never changes.
const { list, featuredCount } = featuredFirst([...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, "en")));
const FEATURED = list.slice(0, featuredCount);
const REST = list.slice(featuredCount);

// The board's search box and country filter. A plain GET form underneath, so it
// still works before hydration; with JS it navigates to the same clean URL the
// server reads (no empty ?player=). Changing the country keeps the searched
// player, so their rank is looked up within that country.
export default function LeaderboardControls({ country, player }: { country: string | null; player: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(player ?? "");
  const [error, setError] = useState<string | null>(null);

  const go = (next: { country: string | null; player: string | null }) =>
    startTransition(() => router.push(boardHref(next)));

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const login = parsePlayer(draft);
    if (draft.trim() && !login) {
      setError("That doesn't look like a GitHub username.");
      return;
    }
    setError(null);
    go({ country, player: login }); // an empty box clears the search
  };

  return (
    <form
      action="/leaderboard"
      method="get"
      role="search"
      onSubmit={onSubmit}
      className="flex flex-col gap-[6px]"
      aria-busy={pending}
    >
      <div className="flex gap-[10px] max-[620px]:flex-col">
        <div className="flex min-w-0 flex-1 gap-[8px]">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Find a GitHub username</span>
            <Search
              size={16}
              className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-ink-mute"
              aria-hidden
            />
            <input
              name="player"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Find a GitHub username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-[44px] w-full rounded-xl border border-line bg-panel/70 pl-[38px] pr-3 text-[14px] text-ink outline-none transition focus:border-brand/60"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="font-display h-[44px] shrink-0 rounded-xl bg-brand px-5 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi disabled:opacity-60"
          >
            FIND
          </button>
        </div>
        <select
          name="country"
          aria-label="Filter by country"
          value={country ?? ""}
          disabled={pending}
          onChange={(e) => go({ country: e.target.value || null, player })}
          className="h-[44px] min-w-0 rounded-xl border border-line bg-panel px-3 text-[14px] text-ink outline-none transition [color-scheme:dark] focus:border-brand/60 disabled:opacity-60 min-[621px]:w-[220px]"
        >
          <option value="">World: every country</option>
          <optgroup label="Basketball nations">
            {FEATURED.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="All countries">
            {REST.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      {error && (
        <p role="alert" className="text-[12.5px] text-ink-soft">
          {error}
        </p>
      )}
    </form>
  );
}
