import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Background from "@/components/Background";
import { Flag } from "@/components/squads/Media";
import { DemoNote, Section, Tile } from "@/components/squads/Panels";
import Pitch from "@/components/squads/Pitch";
import SquadList from "@/components/squads/SquadList";
import { normalizeCountry } from "@/lib/countries";
import { formatCount } from "@/lib/format";
import { REGISTRY_IS_DEMO, countPlayers, topPlayers } from "@/lib/registry";
import { SQUAD_SIZE, buildSquad, teamName } from "@/lib/squad";

// <site>/squads/<code>: a country's strongest 15 from the player registry and
// the starting five (selection rules in lib/squad).
export const dynamic = "force-dynamic";

// A deep player pool gives each position a fair chance to fill.
const POOL = 500;

type Params = { params: Promise<{ country: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const code = normalizeCountry((await params).country);
  if (!code) return { title: "Squad not found · GitHoop", robots: { index: false } };
  const name = teamName(code) ?? code;
  return {
    title: `${name} squad · GitHoop`,
    description: `The strongest 15 developers from ${name} on GitHoop: the starting five, team rating and the full squad, picked from every scouted card.`,
    alternates: { canonical: `/squads/${code}` },
  };
}

export default async function Page({ params }: Params) {
  const code = normalizeCountry((await params).country);
  if (!code) notFound();
  const name = teamName(code) ?? code;
  const [ranked, count] = await Promise.all([topPlayers(0, POOL, code), countPlayers(code)]);
  const squad = buildSquad(ranked.map((r) => r.player));
  // A count that failed on its own (read as 0) shouldn't sit beside a squad.
  const scouted = Math.max(count, ranked.length);
  const open = SQUAD_SIZE - squad.size;

  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      <main className="relative z-[2] mx-auto flex min-h-screen w-full max-w-[880px] flex-col gap-[14px] px-5 pb-12 pt-6">
        <Link href="/squads" className="self-start text-[13px] font-semibold text-ink-soft transition hover:text-brand">
          ← all nations
        </Link>

        <header className="mt-2 flex items-center gap-[16px] max-[420px]:gap-[12px]">
          <Flag
            code={code}
            className="h-[48px] w-[72px] rounded-[5px] max-[420px]:h-[36px] max-[420px]:w-[54px]"
          />
          <div className="min-w-0">
            <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">
              NATIONAL ROSTER
            </div>
            <h1 className="font-display mt-1 break-words text-[clamp(34px,6vw,56px)] leading-[.95]">{name}</h1>
          </div>
        </header>

        {REGISTRY_IS_DEMO && <DemoNote />}

        {squad.size === 0 ? (
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-[20px] py-[36px] text-center">
            <h2 className="font-display text-[clamp(24px,5vw,30px)] leading-none">No {name} players scouted yet</h2>
            <p className="mx-auto mt-[10px] max-w-[440px] text-[14px] leading-[1.55] text-ink-soft">
              The squad is picked from every card the scout has built. Scout a developer from {name} and
              they&apos;re the first name on the team sheet.
            </p>
            <Link
              href="/"
              className="font-display mt-[20px] inline-flex h-[46px] items-center rounded-xl bg-brand px-7 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              SCOUT A PLAYER
            </Link>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-[14px] max-[620px]:gap-[8px]">
              <Tile
                label="TEAM RATING"
                value={String(squad.rating ?? "–")}
                note="starting five average"
                accent="#e9cc74"
              />
              <Tile
                label="SQUAD"
                value={`${squad.size}/${SQUAD_SIZE}`}
                note={open ? `${open} open ${open === 1 ? "slot" : "slots"}` : "full squad"}
                accent="#e6edf3"
              />
              <Tile
                label="SCOUTED"
                value={formatCount(scouted)}
                note={`${scouted === 1 ? "player" : "players"} from ${name}`}
                accent="#e6edf3"
              />
            </div>

            <Section title="STARTING FIVE">
              <Pitch xi={squad.xi} />
            </Section>

            <SquadList squad={squad} />

            <p className="text-[12px] leading-[1.5] text-ink-mute">
              The three best overall ratings at each position make the 15-player roster. The strongest point guard,
              shooting guard, small forward, power forward and center start. A player counts
              for the country in their GitHub location, not the flag picked on their card.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
