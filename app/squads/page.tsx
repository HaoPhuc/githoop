import type { Metadata } from "next";
import Link from "next/link";
import Background from "@/components/Background";
import CountrySearch from "@/components/squads/CountrySearch";
import { Flag } from "@/components/squads/Media";
import { DemoNote } from "@/components/squads/Panels";
import { formatCount } from "@/lib/format";
import { REGIONS } from "@/lib/nations";
import { REGISTRY_IS_DEMO, countPlayers } from "@/lib/registry";
import { teamName } from "@/lib/squad";

// Featured basketball nations, plus a search that reaches every country.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "National squads · GitHoop",
  description:
    "Pick a country and see its 15-player basketball roster, starting five and team rating, picked from every GitHoop card.",
  alternates: { canonical: "/squads" },
};


export default async function Page() {
  // Best-effort: a failed count reads as 0 (lib/registry), never an error.
  const codes = REGIONS.flatMap((region) => region.codes);
  const counts = await Promise.all(codes.map((code) => countPlayers(code)));
  const teams = codes.map((code, i) => ({ code, name: teamName(code) ?? code, scouted: counts[i] }));

  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      <main className="relative z-[2] mx-auto flex min-h-screen w-full max-w-[980px] flex-col gap-[18px] px-5 pb-12 pt-6">
        <Link href="/" className="self-start text-[13px] font-semibold text-ink-soft transition hover:text-brand">
          ← back to GitHoop
        </Link>

        <header className="mt-2">
          <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">NATIONAL SQUADS</div>
          <h1 className="font-display mt-2 text-[clamp(34px,6vw,56px)] leading-[.95]">Call up a nation</h1>
          <p className="mt-2 max-w-[560px] text-[14px] leading-[1.5] text-ink-soft">
            The best 15 developers from each country, picked from every card the scout has built. Pick a team
            for its starting five and team rating.
          </p>
        </header>

        {REGISTRY_IS_DEMO && <DemoNote />}

        <CountrySearch />

        {REGIONS.map(({ codes, label }) => {
          const group = teams.filter((t) => codes.includes(t.code)).sort((a, b) => a.name.localeCompare(b.name, "en"));
          return (
            <section key={label}>
              <div className="mb-[10px] flex items-center gap-[9px]">
                <span className="h-[2px] w-[16px] rounded-full bg-gold" />
                <h2 className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint">
                  {label.toUpperCase()}
                </h2>
              </div>
              <ul className="grid grid-cols-4 gap-[8px] max-[860px]:grid-cols-3 max-[620px]:grid-cols-2">
                {group.map((t) => (
                  <li key={t.code} className="min-w-0">
                    <Link
                      href={`/squads/${t.code}`}
                      className="group flex h-full items-center gap-[10px] rounded-xl border border-white/[0.06] bg-white/[0.02] px-[12px] py-[10px] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-brand/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 max-[420px]:gap-[8px] max-[420px]:px-[10px]"
                    >
                      <Flag code={t.code} className="h-[22px] w-[32px] rounded-[3px] max-[420px]:h-[18px] max-[420px]:w-[26px]" />
                      <span className="min-w-0">
                        <span className="block break-words text-[13.5px] font-semibold leading-tight text-ink-dim transition group-hover:text-ink">
                          {t.name}
                        </span>
                        <span className={`mt-[2px] block text-[12px] ${t.scouted ? "text-ink-soft" : "text-ink-mute"}`}>
                          {t.scouted ? `${formatCount(t.scouted)} scouted` : "none scouted yet"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <p className="text-[12px] leading-[1.5] text-ink-mute">
          A player counts for the country in their GitHub location, not the flag picked on their card.
        </p>
      </main>
    </div>
  );
}
