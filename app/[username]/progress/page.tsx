import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Background from "@/components/Background";
import ProgressionView from "@/components/ProgressionView";
import { loadCard } from "@/lib/scout";

// <site>/<username>/progress: the season history and potential/value outlook
// behind a card. A failed scout goes back to the card route, which owns the
// "no file found" / rate-limit explanations.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const res = await loadCard(username);
  if (!("card" in res)) return { title: `@${username} · GitHoop`, robots: { index: false } };
  const { card } = res;
  return {
    title: `${card.name}: progression · GitHoop`,
    description: `${card.name}'s rating season by season, potential and estimated market value on GitHoop.`,
    alternates: { canonical: `/${card.login}/progress` },
  };
}

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const res = await loadCard(username);
  if (!("card" in res)) redirect(`/${encodeURIComponent(username)}`);
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      <ProgressionView card={res.card} />
    </div>
  );
}
