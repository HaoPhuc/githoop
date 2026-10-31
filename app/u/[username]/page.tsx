import { after } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import Background from "@/components/Background";
import { type GithubError } from "@/lib/github/client";
import { isOrganization } from "@/lib/github/org";
import { loadCard } from "@/lib/scout";
import { getRepoStars } from "@/lib/github/stars";
import { pickFlag } from "@/lib/flagPriority";
import { recordScout } from "@/lib/analytics";
import { playerRank } from "@/lib/registry";
import type { Card } from "@/lib/scoring/types";
import ScoutRoute from "./ScoutRoute";

export const dynamic = "force-dynamic"; // per-user, token-gated, always fresh

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const res = await loadCard(username);
  if ("card" in res) {
    return {
      title: `${res.card.name} — ${res.card.overall} ${res.card.finishLabel} · GitHoop`,
      description: `${res.card.name} scouted on GitHoop: ${res.card.overall} OVR ${res.card.position}, ${res.card.archetype}.`,
      alternates: { canonical: `/${res.card.login}` },
      twitter: { card: "summary_large_image" },
      // og:image comes from the file-convention opengraph-image.tsx (the landscape
      // unfurl card). The portrait basketball card lives at /<login>.png for README embeds.
    };
  }
  // Not a real profile — keep these soft-404s out of the index.
  return { title: `@${username} · GitHoop`, robots: { index: false } };
}

async function NotScouted({ username, error }: { username: string; error: GithubError }) {
  const rateLimited = error.type === "ratelimit";
  // An organization isn't a GitHub user, so scouting one comes back notfound:
  // point it to its club instead.
  const isOrg = error.type === "notfound" && (await isOrganization(username));
  // "No file found" is reserved for errors that are about the USERNAME
  // (missing or impossible); a GitHub-side failure must not blame the user.
  const noSuchUser = error.type === "notfound" || error.type === "invalid";
  const heading = rateLimited ? "The scouts are gassed" : noSuchUser ? "No file found" : "Scouting interrupted";
  const message = rateLimited
    ? `The scouts called a timeout. GitHub has reached its rate limit; try scouting @${username} again shortly.`
    : error.type === "notfound"
      ? `There's no GitHub user named @${username}.`
      : error.type === "invalid"
        ? `“${username}” isn't a valid GitHub username.`
        : error.message;
  return (
    <main className="relative z-[2] mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">SCOUT REPORT</div>
      <h1 className="font-display mt-3 text-[clamp(30px,6vw,48px)] font-black leading-[.95]">{heading}</h1>
      <p className="mt-3 text-[15.5px] leading-[1.5] text-ink-soft">{message}</p>
      {isOrg && (
        <Link
          href={`/club/${username}`}
          className="mt-3 text-[15.5px] font-semibold text-brand underline-offset-4 transition hover:text-brand-hi hover:underline"
        >
          @{username} is an organization. See its club ↗
        </Link>
      )}
      <Link
        href="/"
        className="font-display mt-7 inline-flex h-[46px] items-center rounded-xl bg-brand px-6 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi"
      >
        {rateLimited ? "BACK TO THE BENCH" : "SCOUT SOMEONE ELSE"}
      </Link>
    </main>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const { username } = await params;
  const { country: override } = await searchParams;
  // Stars feed the footer "Support the project" link; fetched alongside the
  // scout (its own 1h cache keeps it cheap) so the report matches the home page.
  // The leaderboard rank is read once the card resolves, not beside it: a first
  // scout records the card while building it, so a parallel read would miss it.
  const scouted = loadCard(username).then(async (res) => ({
    res,
    rank: "card" in res ? await playerRank(res.card.login) : null,
  }));
  const [{ res, rank }, stars] = await Promise.all([scouted, getRepoStars()]);
  // Flag priority: a shared-link ?country= override wins, else the GitHub-derived
  // country. No IP/geo fallback — we never put the *viewer's* country on someone
  // else's card.
  let card: Card | null = "card" in res ? res.card : null;
  let canonicalCountry = ""; // GitHub-derived flag; share links omit ?country= unless overridden
  if (card) {
    after(() => recordScout()); // analytics, flushed after the response (serverless-safe)
    canonicalCountry = pickFlag(null, card.country) ?? ""; // GitHub-derived only
    const displayCountry = pickFlag(override, card.country) ?? "";
    card = { ...card, country: displayCountry };
  }
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      {card ? (
        <ScoutRoute card={card} stars={stars} canonicalCountry={canonicalCountry} rank={rank} />
      ) : (
        <NotScouted username={username} error={(res as { error: GithubError }).error} />
      )}
    </div>
  );
}
