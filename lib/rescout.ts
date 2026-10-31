// Re-scout timing, shared by the server lock (lib/scout) and the "Scouted … ago"
// line on the report. Pure, so the client bundle can use it.

// One forced rebuild per profile per window: the server lock's TTL, and how long
// the Re-scout link stays hidden after a card is built.
export const RESCOUT_COOLDOWN_SECONDS = 15 * 60;

const ageMs = (builtAt: string, now: number) => Math.max(0, now - Date.parse(builtAt));

// "just now", "12 min ago", "3 h ago": coarse on purpose, the cache lives 2 hours.
export function scoutedAgo(builtAt: string, now: number): string {
  const minutes = Math.floor(ageMs(builtAt, now) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

export function canRescout(builtAt: string, now: number): boolean {
  return ageMs(builtAt, now) >= RESCOUT_COOLDOWN_SECONDS * 1000;
}
