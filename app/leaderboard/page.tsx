import type { Metadata } from "next";
import Background from "@/components/Background";
import LeaderboardView from "@/components/leaderboard/LeaderboardView";
import { PAGE_SIZE, pageOffset, parseQuery, resolvePage } from "@/lib/leaderboard";
import { REGISTRY_IS_DEMO, countPlayers, getPlayer, playerRank, topPlayers } from "@/lib/registry";

// <site>/leaderboard: every scouted card ranked by overall, in the world or one
// country (?country=), 50 a page (?page=), and ?player= to open the page a
// player is on with their row highlighted. Bad params fall back to defaults.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard · GitHoop",
  description: "Every GitHub profile scouted on GitHoop, ranked by overall rating. Find your rank, worldwide or by country.",
  alternates: { canonical: "/leaderboard" },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = parseQuery(await searchParams);
  const scope = query.country ?? undefined;
  const [total, found] = await Promise.all([
    countPlayers(scope),
    query.player ? playerRank(query.player, scope) : null,
  ]);
  const page = resolvePage(query.page, total, found?.rank);
  // Not ranked in this country: if they're on the world board, say so instead
  // of sending them to be scouted again.
  const [rows, elsewhere] = await Promise.all([
    total ? topPlayers(pageOffset(page), PAGE_SIZE, scope) : [],
    query.player && !found && scope ? getPlayer(query.player).then(Boolean) : false,
  ]);
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      <LeaderboardView
        query={query}
        page={page}
        total={total}
        rows={rows}
        found={found}
        elsewhere={elsewhere}
        demo={REGISTRY_IS_DEMO}
      />
    </div>
  );
}
