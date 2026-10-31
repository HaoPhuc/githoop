import type { Metadata } from "next";
import Link from "next/link";
import Background from "@/components/Background";
import MergeView from "@/components/MergeView";

// <site>/merge: combine one person's GitHub accounts into one card (lib/merge).
export const metadata: Metadata = {
  title: "Merge accounts · GitHoop",
  description: "Got more than one GitHub account? Merge them into one GitHoop card.",
  alternates: { canonical: "/merge" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ main?: string | string[] }> }) {
  const { main } = await searchParams;
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      <main className="relative z-[2] mx-auto flex min-h-screen w-full max-w-[620px] flex-col gap-[18px] px-5 pb-12 pt-6">
        <Link href="/" className="self-start text-[13px] font-semibold text-ink-soft transition hover:text-brand">
          ← back to GitHoop
        </Link>
        <header className="mt-2">
          <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">ONE PLAYER, ONE CARD</div>
          <h1 className="font-display mt-2 text-[clamp(34px,6vw,56px)] leading-[.95]">Merge accounts</h1>
          <p className="mt-2 text-[14px] leading-[1.5] text-ink-soft">
            Got more than one GitHub account? Merge them and your stars, contributions and followers count
            together on one card. You&apos;ll prove both accounts are yours with a short code.
          </p>
        </header>
        <MergeView initialMain={typeof main === "string" ? main : ""} />
      </main>
    </div>
  );
}
