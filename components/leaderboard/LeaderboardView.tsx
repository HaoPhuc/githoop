import Link from "next/link";
import { countryName } from "@/lib/countries";
import { FINISH_LABELS, FOUNDERS } from "@/lib/scoring/constants";
import type { RankedPlayer } from "@/lib/registry";
import {
  PAGE_SIZE,
  avatarAt,
  boardHref,
  formatRank,
  pageCount,
  rankTier,
  rowId,
  type BoardQuery,
  type BoardRank,
} from "@/lib/leaderboard";
import { RESULT_THEME } from "../finishTheme";
import LeaderboardControls from "./LeaderboardControls";
import ScrollToRow from "./ScrollToRow";

// The global leaderboard: every scouted card ranked by overall, 50 a page, in
// the world or one country (lib/registry), with a username search that opens
// the page the player is on and highlights their row.

interface Props {
  query: BoardQuery;
  page: number;
  total: number; // players in the scope (world or the filtered country)
  rows: RankedPlayer[];
  found: BoardRank | null; // the searched player's place in this scope
  elsewhere: boolean; // searched player is ranked, just not in this country
  demo: boolean;
}

// Podium metals: the theme's gold, and a silver and bronze pitched to the same
// weight against the midnight surface.
const MEDAL = { gold: "#d4af37", silver: "#c3ccd6", bronze: "#cd8550" } as const;

// One grid for the column labels and every row. Language drops out first, then
// position (it moves under the name), so a 375px phone keeps rank, player, OVR.
const COLS =
  "grid grid-cols-[44px_minmax(0,1fr)_52px_minmax(0,110px)_56px] gap-x-[12px] max-[760px]:grid-cols-[44px_minmax(0,1fr)_52px_56px] max-[560px]:grid-cols-[38px_minmax(0,1fr)_50px] max-[560px]:gap-x-[10px]";

const flagSrc = (code: string) => `/badges/flags/${code}.png`;
const players = (n: number) => `${formatRank(n)} ${n === 1 ? "player" : "players"}`;

function RankBadge({ rank }: { rank: number }) {
  const tier = rankTier(rank);
  if (tier && tier !== "top10") {
    const metal = MEDAL[tier];
    return (
      <span
        className="font-display flex h-[30px] w-[30px] items-center justify-center rounded-full border text-[17px] leading-none tabular-nums"
        style={{ color: metal, borderColor: `${metal}99`, background: `${metal}1f`, boxShadow: `0 0 14px ${metal}33` }}
      >
        {rank}
      </span>
    );
  }
  return (
    <span
      className={`font-display pl-[4px] text-[18px] leading-none tabular-nums max-[560px]:text-[16px] ${tier ? "text-ink" : "text-ink-faint"}`}
    >
      {formatRank(rank)}
    </span>
  );
}

function Row({ entry, highlighted }: { entry: RankedPlayer; highlighted: boolean }) {
  const { rank, player: p } = entry;
  const tier = rankTier(rank);
  const metal = tier && tier !== "top10" ? MEDAL[tier] : null;
  const country = countryName(p.country);
  // Search beats the medal wash: the ring and green tint say "this one".
  const tone = highlighted
    ? "bg-brand/[0.09] ring-1 ring-inset ring-brand/60"
    : tier === "top10"
      ? "bg-white/[0.025] hover:bg-white/[0.05]"
      : "hover:bg-white/[0.035]";
  return (
    <li id={rowId(p.login)} className="scroll-mt-[96px]">
      <Link
        href={`/${p.login}`}
        prefetch={false} // fifty dynamic card routes: fetch one on click, not all in view
        aria-current={highlighted ? "true" : undefined}
        aria-label={`#${rank} ${p.name} (@${p.login}), ${p.overall} overall, ${p.position}`}
        className={`${COLS} items-center px-[14px] py-[10px] transition max-[560px]:px-[12px] ${tone}`}
        style={
          metal && !highlighted
            ? { background: `linear-gradient(90deg, ${metal}1a, transparent 60%)`, boxShadow: `inset 3px 0 0 ${metal}` }
            : undefined
        }
      >
        <RankBadge rank={rank} />
        <span className="flex min-w-0 items-center gap-[12px] max-[560px]:gap-[10px]">
          {p.avatarUrl ? (
            <img
              src={avatarAt(p.avatarUrl, 80)}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="h-[40px] w-[40px] shrink-0 rounded-full border border-white/10 bg-panel object-cover max-[560px]:h-[36px] max-[560px]:w-[36px]"
            />
          ) : (
            <span className="h-[40px] w-[40px] shrink-0 rounded-full border border-white/10 bg-panel max-[560px]:h-[36px] max-[560px]:w-[36px]" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] font-semibold leading-tight text-ink">{p.name}</span>
            <span className="mt-[3px] flex min-w-0 items-center gap-[6px] text-[12px] leading-none text-ink-faint">
              {country && (
                <img
                  src={flagSrc(p.country)}
                  alt={country}
                  title={country}
                  height={11}
                  className="h-[11px] w-auto shrink-0 rounded-[2px]"
                />
              )}
              <span className="truncate font-mono">@{p.login}</span>
              <span className="hidden shrink-0 max-[560px]:inline">· {p.position}</span>
            </span>
          </span>
        </span>
        <span className="font-display text-[16px] tracking-[.1em] text-ink-dim max-[560px]:hidden">{p.position}</span>
        <span className="truncate text-[13px] text-ink-soft max-[760px]:hidden">{p.topLanguage ?? "—"}</span>
        <span className="flex flex-col items-end">
          <span
            className="font-display text-[30px] leading-[.9] tabular-nums max-[560px]:text-[26px]"
            style={{ color: RESULT_THEME[p.finish].ink }}
          >
            {p.overall}
          </span>
          <span className="font-display mt-[2px] text-[9.5px] tracking-[.14em] text-ink-mute">
            {FINISH_LABELS[p.finish]}
          </span>
        </span>
      </Link>
    </li>
  );
}

// The answer to a ?player= search, above the board.
function SearchNotice({
  login,
  found,
  elsewhere,
  country,
}: {
  login: string;
  found: BoardRank | null;
  elsewhere: boolean;
  country: string | null;
}) {
  const where = country ? countryName(country) : null;
  const who = <span className="font-mono text-ink">@{login}</span>;
  const link = "font-semibold text-ink-soft underline-offset-2 transition hover:text-brand hover:underline";
  return (
    <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[4px] rounded-xl border border-white/[0.06] bg-white/[0.02] px-[14px] py-[11px] text-[13.5px] text-ink-soft">
      {found ? (
        <span>
          {who} is ranked <span className="font-semibold text-ink">#{formatRank(found.rank)}</span> of{" "}
          {formatRank(found.total)}
          {where ? ` in ${where}` : " in the world"}.
        </span>
      ) : elsewhere ? (
        <>
          <span>
            {who} isn&apos;t on the {where} board.
          </span>
          <Link href={boardHref({ player: login })} className={link}>
            find them on the world board ↗
          </Link>
        </>
      ) : FOUNDERS[login.toLowerCase()] ? (
        // Founder overalls are set by hand, so the registry leaves them out.
        <span>{who} built GitHoop: founder cards are rated by hand and stay off the board.</span>
      ) : (
        <>
          <span>{who} isn&apos;t on the board yet.</span>
          <Link
            href={`/${login}`}
            prefetch={false}
            className="font-semibold text-brand underline-offset-2 transition hover:text-brand-hi hover:underline"
          >
            scout them to add them ↗
          </Link>
        </>
      )}
      <Link href={boardHref({ country })} className={`ml-auto text-[12.5px] ${link}`}>
        clear search
      </Link>
    </div>
  );
}

function EmptyBoard({ country }: { country: string | null }) {
  const where = country ? countryName(country) : null;
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-12 text-center">
      <div className="font-display text-[clamp(26px,5vw,34px)] leading-none">
        {where ? `No one from ${where} yet` : "The board is empty"}
      </div>
      <p className="mt-3 max-w-[420px] text-[14px] leading-[1.5] text-ink-soft">
        {where
          ? `Players land here when their GitHub location says ${where}. Scout one to put them on the board.`
          : "Every scouted GitHub profile lands here. Scout one to put the first player on the board."}
      </p>
      <Link
        href="/"
        className="font-display mt-6 inline-flex h-[44px] items-center rounded-xl bg-brand px-6 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi"
      >
        SCOUT A PLAYER
      </Link>
      {where && (
        <Link
          href={boardHref()}
          className="mt-4 text-[13px] font-semibold text-ink-soft underline-offset-2 transition hover:text-brand hover:underline"
        >
          see the world board
        </Link>
      )}
    </div>
  );
}

function Pagination({ page, pages, total, country }: { page: number; pages: number; total: number; country: string | null }) {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const step = "text-[13px] font-semibold text-ink-soft transition hover:text-brand";
  const off = "text-[13px] font-semibold text-ink-mute/50";
  return (
    <nav aria-label="Leaderboard pages" className="flex items-center justify-between gap-3 px-[4px]">
      {page > 1 ? (
        <Link href={boardHref({ country, page: page - 1 })} rel="prev" className={step}>
          ← prev
        </Link>
      ) : (
        <span aria-hidden className={off}>
          ← prev
        </span>
      )}
      <span className="text-center text-[12.5px] tabular-nums text-ink-mute">
        Page {formatRank(page)} of {formatRank(pages)}
        <span className="max-[420px]:hidden">
          {" "}
          · ranks {formatRank(from)}–{formatRank(to)}
        </span>
      </span>
      {page < pages ? (
        <Link href={boardHref({ country, page: page + 1 })} rel="next" className={step}>
          next →
        </Link>
      ) : (
        <span aria-hidden className={off}>
          next →
        </span>
      )}
    </nav>
  );
}

export default function LeaderboardView({ query, page, total, rows, found, elsewhere, demo }: Props) {
  const { country, player } = query;
  const where = country ? countryName(country) : null;
  const pages = pageCount(total);
  const highlight = found && player ? rowId(player) : null;
  // Name a found player as GitHub spells them, not as they were typed.
  const shown = rows.find((r) => rowId(r.player.login) === highlight)?.player.login ?? player;
  const title = where ? `${where} rankings` : "World rankings";

  return (
    <main className="relative z-[2] mx-auto flex min-h-screen w-full max-w-[880px] flex-col gap-[14px] px-[clamp(16px,4vw,20px)] pb-12 pt-6">
      <Link href="/" className="self-start text-[13px] font-semibold text-ink-soft transition hover:text-brand">
        ← back home
      </Link>

      <header className="mt-2">
        <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">LEADERBOARD</div>
        <h1 className="font-display mt-2 flex items-center gap-[14px] text-[clamp(34px,6vw,56px)] leading-[.95]">
          {country && (
            <img src={flagSrc(country)} alt="" className="h-[.62em] w-auto shrink-0 rounded-[4px] border border-white/10" />
          )}
          <span className="min-w-0">{title}</span>
        </h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          {total ? players(total) : where ? "Players" : "Every scouted card"}
          {where ? ` from ${where}` : ""}, ranked by overall rating.
        </p>
      </header>

      <LeaderboardControls key={player ?? ""} country={country} player={player} />

      {shown && <SearchNotice login={shown} found={found} elsewhere={elsewhere} country={country} />}

      {rows.length ? (
        <>
          <section aria-label={title} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div
              aria-hidden
              className={`${COLS} font-display border-b border-white/[0.06] px-[14px] pb-[9px] pt-[12px] text-[11px] font-bold tracking-[.22em] text-ink-faint max-[560px]:px-[12px]`}
            >
              <span>RANK</span>
              <span>PLAYER</span>
              <span className="max-[560px]:hidden">POS</span>
              <span className="max-[760px]:hidden">LANGUAGE</span>
              <span className="text-right">OVR</span>
            </div>
            <ol className="divide-y divide-white/[0.05]">
              {rows.map((entry) => (
                <Row key={entry.player.login} entry={entry} highlighted={rowId(entry.player.login) === highlight} />
              ))}
            </ol>
          </section>
          {pages > 1 && <Pagination page={page} pages={pages} total={total} country={country} />}
          {highlight && <ScrollToRow id={highlight} />}
        </>
      ) : (
        <EmptyBoard country={country} />
      )}

      <div className="flex flex-col gap-[6px] text-[12px] leading-[1.5] text-ink-mute">
        <p>
          A card joins the board the first time it&apos;s scouted and moves when it&apos;s rebuilt. Country comes
          from the GitHub profile&apos;s location; the flag you pick on a card doesn&apos;t change it.
        </p>
        {demo && (
          <p>
            Demo board: the sample profiles plus cards scouted on this server. Set REDIS_URL for a shared
            leaderboard.
          </p>
        )}
      </div>
    </main>
  );
}
