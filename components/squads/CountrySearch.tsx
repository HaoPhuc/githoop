"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchCountries } from "@/lib/countries";
import { teamName } from "@/lib/squad";
import { Flag } from "./Media";

// Reaches any country, including those outside the featured basketball nations: type, then pick a
// match, or press Enter for the top one.
const MAX_MATCHES = 8;

export default function CountrySearch() {
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState("");
  const q = query.trim();
  const matches = useMemo(() => (q ? searchCountries(q).slice(0, MAX_MATCHES) : []), [q]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (matches[0]) router.push(`/squads/${matches[0].code}`);
      }}
    >
      <label htmlFor={id} className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint">
        FIND ANY COUNTRY
      </label>
      <div className="relative mt-[8px]">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-ink-mute"
        />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by country name"
          autoComplete="off"
          spellCheck={false}
          className="h-[44px] w-full rounded-xl border border-line bg-white/[0.03] pl-[38px] pr-[12px] text-[15px] text-ink outline-none transition focus:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/40"
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {q ? `${matches.length} ${matches.length === 1 ? "country" : "countries"} found` : ""}
      </p>
      {q &&
        (matches.length ? (
          <ul className="mt-[10px] flex flex-wrap gap-[6px]">
            {matches.map((c) => (
              <li key={c.code} className="min-w-0 max-w-full">
                <Link
                  href={`/squads/${c.code}`}
                  className="flex max-w-full items-center gap-[8px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-[10px] py-[6px] text-[13.5px] text-ink-dim transition hover:border-brand/55 hover:text-ink"
                >
                  <Flag code={c.code} className="h-[14px] w-[20px] rounded-[2px]" />
                  <span className="truncate">{teamName(c.code)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-[10px] text-[13px] text-ink-mute">No country matches &ldquo;{q}&rdquo;.</p>
        ))}
    </form>
  );
}
