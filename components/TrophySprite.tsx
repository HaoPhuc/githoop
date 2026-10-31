import type { AwardKey } from "@/lib/scoring/types";

// Stable keys keep serialized cards compatible; every visual is basketball-specific.
type SpriteKey = AwardKey | "ball";
export const AWARD_SPRITES: Record<AwardKey, { sprite: SpriteKey; tint?: string }> = {
  world_cup: { sprite: "world_cup" },
  ballon_dor: { sprite: "ballon_dor" },
  wc_golden_ball: { sprite: "wc_golden_ball" },
  golden_boot: { sprite: "golden_boot" },
};

export default function TrophySprite({ sprite, size, className }: { sprite: SpriteKey; size: number; className?: string }) {
  const gold = sprite === "wc_golden_ball" ? "#d9e1e8" : "#e9c66b";
  return (
    <svg aria-hidden className={className} width={size} height={size} viewBox="0 0 100 100" fill="none">
      {sprite !== "ball" && <><path d="M39 58h22l-3 19H42Z" fill={gold} /><rect x="28" y="79" width="44" height="10" rx="2" fill={gold} /><path d="M31 91h38" stroke={gold} strokeWidth="4" /></>}
      <circle cx="50" cy={sprite === "ball" ? 50 : 33} r="25" fill={gold} />
      <g stroke="#59441f" strokeWidth="2.4">
        <path d={sprite === "ball" ? "M25 50h50M50 25v50M32 32c26 0 36 10 36 36M32 68c0-26 10-36 36-36" : "M25 33h50M50 8v50M32 15c26 0 36 10 36 36M32 51c0-26 10-36 36-36"} />
      </g>
      {sprite === "world_cup" && <path d="M20 32H9v10c0 15 12 21 27 21M80 32h11v10c0 15-12 21-27 21" stroke={gold} strokeWidth="6" />}
      {sprite === "golden_boot" && <path d="m49 16-11 20h12l-3 16 16-23H51l5-13Z" fill="#59441f" />}
    </svg>
  );
}
