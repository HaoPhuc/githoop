"use client";

import Link from "next/link";
import { Archive, ArrowLeftRight, ArrowUpRight, Star } from "lucide-react";
import type { Club, ClubFacts } from "@/lib/scoring/club";
import { STAT_LABELS, STATS } from "@/lib/scoring/constants";
import type { StatKey } from "@/lib/scoring/types";
import { formatCount } from "@/lib/format";
import { languageLogoUrl, logoSlugFor } from "@/lib/github/languages";
import { RESULT_THEME } from "../finishTheme";
import ClubCard from "./ClubCard";
import SquadPitch from "./SquadPitch";

// The club page: the club card, its facts (stars, repos, languages, top
// repositories), the starting five on a court, and what each club stat was rated
// from (lib/scoring/club).

// Data marks use the basketball orange on every card tier.
const MARK = "#f58b3b";

const hideOnError: React.ReactEventHandler<HTMLImageElement> = (e) => {
  e.currentTarget.style.display = "none";
};

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? "" : "s"}`;

// The count behind each club stat, in words.
const SIGNALS: Record<StatKey, (f: ClubFacts) => string> = {
  ath: (f) => `${plural(f.activeRepos, "repo")} pushed in the last 90 days`,
  sho: (f) => `${plural(f.stars, "star")}, ${formatCount(f.topRepoStars)} on the top repo`,
  pas: (f) => `${plural(f.contributors, "contributor")} on the sampled repos`,
  hnd: (f) => `${plural(f.languages, "primary language")}`,
  def: (f) => `${plural(f.forks, "fork")} building on its code`,
  reb: (f) => `${plural(f.publicRepos, "public repo")}, ${plural(Math.floor(f.ageYears), "year")} on GitHub`,
};

function Section({
  title,
  accent,
  className,
  children,
}: {
  title: string;
  accent: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-[16px] ${className ?? ""}`}>
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

function Languages({ club }: { club: Club }) {
  if (!club.languages.length) return <p className="text-[13.5px] text-ink-mute">No languages on its public repos yet.</p>;
  return (
    <ul className="flex flex-wrap gap-[8px]">
      {club.languages.map((l) => {
        const slug = logoSlugFor(l.name);
        return (
          <li
            key={l.name}
            className="inline-flex items-center gap-[7px] rounded-lg border border-white/[0.07] bg-white/[0.03] px-[10px] py-[6px]"
          >
            {slug && (
              <img
                src={languageLogoUrl(slug)}
                onError={hideOnError}
                alt=""
                aria-hidden
                className="h-[15px] w-[15px] object-contain"
              />
            )}
            <span className="text-[13.5px] font-medium text-ink-dim">{l.name}</span>
            <span className="text-[12px] tabular-nums text-ink-mute">{plural(l.repos, "repo")}</span>
          </li>
        );
      })}
    </ul>
  );
}

function TopRepos({ club }: { club: Club }) {
  if (!club.topRepos.length) return <p className="text-[13.5px] text-ink-mute">No public repositories yet.</p>;
  return (
    <ol className="flex flex-col">
      {club.topRepos.map((r) => (
        <li key={r.name} className="border-b border-white/[0.06] py-[10px] first:pt-0 last:border-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-3">
            <a
              href={`https://github.com/${club.login}/${r.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-[4px] text-[14.5px] font-semibold text-ink transition hover:text-brand"
            >
              <span className="truncate">{r.name}</span>
              <ArrowUpRight size={13} className="shrink-0 text-ink-mute" aria-hidden />
            </a>
            <span className="inline-flex shrink-0 items-center gap-[4px] text-[13px] tabular-nums text-ink-soft">
              <Star size={13} className="fill-current text-gold-hi" aria-hidden />
              {formatCount(r.stars)}
              <span className="sr-only">stars</span>
            </span>
          </div>
          {r.description && (
            <p className="mt-[3px] line-clamp-2 text-[12.5px] leading-[1.45] text-ink-faint [overflow-wrap:anywhere]">
              {r.description}
            </p>
          )}
          <p className="mt-[4px] flex flex-wrap items-center gap-x-[10px] text-[12px] text-ink-mute">
            {r.language && <span>{r.language}</span>}
            <span>{plural(r.forks, "fork")}</span>
            {r.archived && (
              <span className="inline-flex items-center gap-[4px]">
                <Archive size={12} aria-hidden />
                archived
              </span>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

function ClubStats({ club }: { club: Club }) {
  return (
    <div className="grid grid-cols-2 gap-x-[28px] gap-y-[13px] max-[620px]:grid-cols-1">
      {STATS.map((k) => (
        <div key={k} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-[10px]">
              <span className="font-display text-[15px] tracking-[.08em] text-ink-dim">{STAT_LABELS[k]}</span>
              <span className="text-[12.5px] text-ink-mute">{SIGNALS[k](club.facts)}</span>
            </span>
            <span className="font-display text-[17px] leading-none tabular-nums text-ink">{club.stats[k]}</span>
          </div>
          <div className="mt-[7px] h-[4px] rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full" style={{ width: `${club.stats[k]}%`, background: MARK }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ClubView({ club }: { club: Club }) {
  const accent = RESULT_THEME[club.finish].ink;
  const { squad, facts } = club;
  const founded = new Date(club.createdAt).getUTCFullYear();
  const sampled = club.sampledRepos.join(", ");

  return (
    <main className="relative z-[2] mx-auto flex min-h-screen w-full max-w-[960px] flex-col gap-[14px] px-5 pb-12 pt-6">
      <Link href="/" className="self-start text-[13px] font-semibold text-ink-soft transition hover:text-brand">
        ← scout a player
      </Link>

      <header className="mt-2 min-w-0">
        <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">CLUB</div>
        <h1 className="font-display mt-2 text-[clamp(34px,6vw,56px)] leading-[.95] [overflow-wrap:anywhere]">
          {club.name}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-[8px] text-[14px] text-ink-soft">
          <a
            href={`https://github.com/${club.login}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[13px] text-ink-faint underline-offset-2 transition hover:text-brand hover:underline"
          >
            @{club.login}
          </a>
          <span aria-hidden>·</span>
          <span>founded {founded}</span>
          {club.location && (
            <>
              <span aria-hidden>·</span>
              <span className="[overflow-wrap:anywhere]">{club.location}</span>
            </>
          )}
        </p>
        {club.description && (
          <p className="mt-[10px] max-w-[640px] text-[14.5px] leading-[1.5] text-ink-dim [overflow-wrap:anywhere]">
            {club.description}
          </p>
        )}
      </header>

      <div className="grid grid-cols-[minmax(0,300px)_minmax(0,1fr)] items-start gap-[14px] max-[760px]:grid-cols-1">
        <div className="mx-auto w-full max-w-[300px] py-[6px]">
          <ClubCard club={club} />
        </div>

        <div className="flex min-w-0 flex-col gap-[14px]">
          <div className="grid grid-cols-3 gap-[14px] max-[620px]:gap-[8px]">
            <Tile label="STARS" value={formatCount(facts.stars)} note="on its top repos" accent={accent} />
            <Tile
              label="REPOS"
              value={formatCount(facts.publicRepos)}
              note={`${formatCount(facts.activeRepos)} pushed in 90 days`}
              accent={accent}
            />
            <Tile
              label="SQUAD"
              value={squad.rating === null ? "–" : String(squad.rating)}
              note={`${squad.size} of 5 starters · ${squad.bench.length} on bench`}
              accent={accent}
            />
          </div>
          <Section title="MAIN LANGUAGES" accent={accent}>
            <Languages club={club} />
          </Section>
          <Section title="TOP REPOSITORIES" accent={accent}>
            <TopRepos club={club} />
          </Section>
        </div>
      </div>

      <Section title={`STARTING FIVE · ${squad.formation}`} accent={accent}>
        {squad.size ? (
          <>
            <SquadPitch squad={squad} />
            <p className="mt-[10px] flex flex-wrap items-center gap-x-[14px] gap-y-[4px] text-[12px] text-ink-mute">
              <span className="inline-flex items-center gap-[5px]">
                <ArrowLeftRight size={12} className="text-gold-hi" aria-hidden />
                out of position
              </span>
              <span>Tap a player for their card.</span>
            </p>
          </>
        ) : (
          <p className="py-2 text-[13.5px] text-ink-mute">
            No contributors to scout on its public repos yet, so there&apos;s no squad.
          </p>
        )}
        {club.complete === false && (
          <p className="mt-[8px] text-[12.5px] text-ink-soft">
            A few players couldn&apos;t be scouted just now. The squad fills in on a later visit.
          </p>
        )}
      </Section>

      {squad.bench.length > 0 && (
        <Section title="BENCH" accent={accent}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {squad.bench.map((player) => (
              <li key={player.login}>
                <Link href={`/${player.login}`} className="flex items-center gap-3 rounded bg-white/5 px-3 py-2 text-[14px] transition hover:bg-white/10">
                  <span className="min-w-0 flex-1 truncate">{player.name || player.login}</span>
                  <span className="text-ink-soft">{player.position}</span>
                  <span className="font-display text-[20px] tabular-nums" style={{ color: accent }}>{player.overall}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="HOW THE CLUB IS RATED" accent={accent}>
        <ClubStats club={club} />
        <p className="mt-[12px] text-[12.5px] leading-[1.5] text-ink-soft">
          Each count is rated like a player&apos;s stats: a typical active org scores 60, an elite one 99. The club
          overall is the average of the six: {club.overall}, {club.finishLabel}.
        </p>
      </Section>

      <p className="text-[12px] leading-[1.5] text-ink-mute [overflow-wrap:anywhere]">
        The squad is the org&apos;s top contributors on its most-starred repos{sampled ? ` (${sampled})` : ""}, each
        rated by their own GitHoop card. Bots are left out. Up to 15 contributors make the roster, with one starter at each
        basketball position. If a role is missing, the strongest reserve fills the nearest open position.
      </p>
    </main>
  );
}
