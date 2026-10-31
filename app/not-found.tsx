import type { Metadata } from "next";
import Link from "next/link";
import Background from "@/components/Background";
import Mascot from "@/components/Mascot";

export const metadata: Metadata = {
  title: "404 · Out of bounds — GitHoop",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />

      <main className="relative z-[2] mx-auto flex min-h-screen max-w-[600px] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 motion-safe:animate-float">
          <Mascot size={104} />
        </div>

        <p className="font-display text-[12px] font-bold tracking-[.3em] text-brand">TURNOVER</p>

        <h1 className="font-display mt-2 text-[clamp(64px,16vw,112px)] font-black leading-[.9]">
          <span aria-hidden>OUT OF<br />BOUNDS</span>
          <span className="sr-only">Out of bounds — 404, page not found</span>
        </h1>

        <p className="font-mono mt-2 text-[13px] font-medium tracking-[.55em] text-ink-faint">
          4 · 0 · 4
        </p>

        <p className="mt-5 max-w-[430px] text-[15.5px] leading-[1.55] text-ink-soft">
          This page stepped out of bounds — there&rsquo;s no route here on the court.
        </p>

        <div className="mt-8 flex flex-col items-center gap-[14px]">
          <Link
            href="/"
            className="font-display inline-flex h-[46px] items-center rounded-xl bg-brand px-7 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            BACK TO THE COURT
          </Link>
          <Link
            href="/"
            className="rounded text-[13.5px] font-medium text-ink-faint underline-offset-4 transition hover:text-brand hover:underline focus-visible:text-brand focus-visible:underline focus-visible:outline-none"
          >
            Scout a developer &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}
