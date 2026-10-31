import { describe, expect, it } from "vitest";
import { canRescout, RESCOUT_COOLDOWN_SECONDS, scoutedAgo } from "@/lib/rescout";

const BUILT = "2026-10-30T10:00:00.000Z";
const after = (minutes: number) => Date.parse(BUILT) + minutes * 60_000;

describe("scoutedAgo", () => {
  it("reads coarse, human ages", () => {
    expect(scoutedAgo(BUILT, after(0.5))).toBe("just now");
    expect(scoutedAgo(BUILT, after(1))).toBe("1 min ago");
    expect(scoutedAgo(BUILT, after(47))).toBe("47 min ago");
    expect(scoutedAgo(BUILT, after(130))).toBe("2 h ago");
  });

  it("never goes negative when the client clock runs behind", () => {
    expect(scoutedAgo(BUILT, after(-3))).toBe("just now");
  });
});

describe("canRescout", () => {
  it("opens once the cooldown has passed", () => {
    const cooldownMin = RESCOUT_COOLDOWN_SECONDS / 60;
    expect(canRescout(BUILT, after(cooldownMin - 1))).toBe(false);
    expect(canRescout(BUILT, after(cooldownMin))).toBe(true);
  });
});
