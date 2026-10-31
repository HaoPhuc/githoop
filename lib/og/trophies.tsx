import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AWARD_META, type AwardGroup } from "@/lib/awards";
import type { AwardKey } from "@/lib/scoring/types";
const DIMS: Record<AwardKey, { w: number; h: number }> = {
  ballon_dor: { w: 100, h: 100 },
  wc_golden_ball: { w: 100, h: 100 },
  golden_boot: { w: 100, h: 100 },
  world_cup: { w: 100, h: 100 },
};

// Basketball trophy artwork shared by the social previews. SVG data URIs keep
// the server-rendered shelf sharp at any size without football sprite assets.

// Tallest trophy across the set — the scale reference, so a given trophy is the
// same size in every cabinet regardless of what sits next to it.
const MAX_H = Math.max(...Object.values(DIMS).map((d) => d.h));

const stillFile = (key: AwardKey) => join(process.cwd(), "public", "awards", `${key}.svg`);

async function fileDataUri(absPath: string): Promise<string | null> {
  try {
    return `data:image/svg+xml;base64,${(await readFile(absPath)).toString("base64")}`;
  } catch {
    return null;
  }
}

export type TrophyStills = Partial<Record<AwardKey, string>>;

// Load the still data URIs for exactly the trophies a cabinet holds. Best-effort:
// a missing file drops that trophy rather than failing the whole image.
export async function loadTrophyStills(groups: AwardGroup[]): Promise<TrophyStills> {
  const entries = await Promise.all(
    groups.map(async (g) => [g.key, await fileDataUri(stillFile(g.key))] as const),
  );
  return Object.fromEntries(entries.filter(([, uri]) => uri)) as TrophyStills;
}

// The shelf element. `tall` sets the tallest trophy's height in px; everything
// else derives from it (labels, badge, gaps) so the two call sites (profile
// unfurl, home unfurl) only pass one number.
export function trophyShelf({
  groups,
  stills,
  tall = 96,
  header = "Trophies won",
  headerColor = "#e9cc74",
  labelColor = "#8b93a1",
  badgeColor = "#e9cc74",
}: {
  groups: AwardGroup[];
  stills: TrophyStills;
  tall?: number;
  header?: string | null;
  headerColor?: string;
  labelColor?: string;
  badgeColor?: string;
}) {
  const k = tall / MAX_H;
  const shown = groups.filter((g) => stills[g.key]);
  if (!shown.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* the brand's headline device — white text, accent period — so the
          header reads anchored instead of floating (see GET SCOUTED.) */}
      {header && (
        <div style={{ display: "flex", fontSize: tall * 0.29, fontWeight: 700, color: "#e6edf3", marginBottom: tall * 0.15 }}>
          <span style={{ display: "flex" }}>{header}</span>
          <span style={{ display: "flex", color: headerColor }}>.</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: tall * 0.46 }}>
        {shown.map((g) => {
          const d = DIMS[g.key];
          const w = Math.round(d.w * k);
          const h = Math.round(d.h * k);
          const n = g.instances.length;
          return (
            <div key={g.key} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {/* fixed-height box, image bottom-aligned -> shared shelf line */}
              <div style={{ display: "flex", height: tall, alignItems: "flex-end", justifyContent: "center" }}>
                <div style={{ display: "flex", position: "relative" }}>
                  <img alt="" src={stills[g.key]!} width={w} height={h} style={{ width: w, height: h }} />
                  {n > 1 && (
                    <div
                      style={{
                        position: "absolute",
                        top: -tall * 0.06,
                        right: -tall * 0.16,
                        display: "flex",
                        fontSize: tall * 0.26,
                        fontWeight: 700,
                        color: badgeColor,
                      }}
                    >
                      ×{n}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: tall * 0.1,
                  fontSize: Math.max(tall * 0.12, 11),
                  fontWeight: 500,
                  letterSpacing: 1.4,
                  color: labelColor,
                }}
              >
                {AWARD_META[g.key].shelfLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
