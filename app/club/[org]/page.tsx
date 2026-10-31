import type { Metadata } from "next";
import Link from "next/link";
import Background from "@/components/Background";
import ClubView from "@/components/club/ClubView";
import type { GithubError } from "@/lib/github/client";
import { loadClub } from "@/lib/club";

// <site>/club/<org>: a GitHub organization as a basketball team, rated from its
// repos and fielding its top contributors (lib/club). The /club segment is
// static, so it wins over the /<username> route.
export const dynamic = "force-dynamic"; // per-org, token-gated, cached in Redis rather than at build

export async function generateMetadata({ params }: { params: Promise<{ org: string }> }): Promise<Metadata> {
  const { org } = await params;
  const res = await loadClub(org);
  if ("club" in res) {
    const { club } = res;
    return {
      title: `${club.name} club · GitHoop`,
      description: `${club.name} as a basketball team on GitHoop: ${club.overall} ${club.finishLabel}, a starting five drawn from its top contributors.`,
      alternates: { canonical: `/club/${club.login}` },
    };
  }
  // Not a real org (or GitHub said no) — keep these soft-404s out of the index.
  return { title: `@${org} club · GitHoop`, robots: { index: false } };
}

function ClubNotScouted({ org, error }: { org: string; error: GithubError }) {
  const rateLimited = error.type === "ratelimit";
  // "No club found" is only for errors about the NAME; a GitHub-side failure
  // must not blame the org.
  const noSuchOrg = error.type === "notfound" || error.type === "invalid";
  const heading = rateLimited ? "The scouts are gassed" : noSuchOrg ? "No club found" : "Scouting interrupted";
  return (
    <main className="relative z-[2] mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">CLUB REPORT</div>
      <h1 className="font-display mt-3 text-[clamp(30px,6vw,48px)] font-black leading-[.95]">{heading}</h1>
      <p className="mt-3 text-[15.5px] leading-[1.5] text-ink-soft [overflow-wrap:anywhere]">
        {rateLimited ? (
          `The scouts called a timeout. GitHub has reached its rate limit; try scouting @${org} again shortly.`
        ) : error.type === "notfound" ? (
          <>
            There&apos;s no GitHub organization named @{org}. If it&apos;s a person,{" "}
            <Link href={`/${org}`} className="font-semibold text-brand underline-offset-4 hover:underline">
              scout them as a player
            </Link>
            .
          </>
        ) : error.type === "invalid" ? (
          `“${org}” isn't a valid GitHub organization name.`
        ) : (
          error.message
        )}
      </p>
      <Link
        href="/"
        className="font-display mt-7 inline-flex h-[46px] items-center rounded-xl bg-brand px-6 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi"
      >
        {rateLimited ? "BACK TO THE BENCH" : "SCOUT SOMEONE ELSE"}
      </Link>
    </main>
  );
}

export default async function Page({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const res = await loadClub(org);
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      {"club" in res ? <ClubView club={res.club} /> : <ClubNotScouted org={org} error={res.error} />}
    </div>
  );
}
