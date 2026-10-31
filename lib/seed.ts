import "server-only";
import { redis } from "./redis";
import { scoutCard } from "./scout";
import { unrecorded } from "./registry";
import { followerRankPage } from "./github/search";
import type { GithubError } from "./github/client";

// Seeds the player registry with GitHub at large, so the leaderboard and the
// national squads aren't only the people someone happened to look up. Each run
// (the daily cron, or a manual call to /api/cron/seed) scouts the next players
// down GitHub's follower ranking, most followed first, for a fixed time budget.
// A scout records its card like any other, so seeded players are ordinary
// registry entries.
//
// State lives in Redis: a queue of logins still to scout, and a cursor holding
// the follower count the next ranking page starts at. When the queue runs dry a
// run fetches the next page, skips the players already on the board and queues
// the rest. A lock keeps a manual run and the cron from overlapping.

const V = "v1";
const QUEUE = `githoop:seed:${V}:queue`;
const CURSOR = `githoop:seed:${V}:cursor`; // next page's follower ceiling; "-1" once the ranking is exhausted
const LOCK = `githoop:seed:${V}:lock`;

const PARALLEL = 8; // scouts in flight at once
const PAGES_PER_RUN = 3; // ranking pages one run may fetch (search allows 30/min)

export interface SeedReport {
  scouted: number;
  failed: number;
  queued: number; // logins left in the queue after the run
  stopped: "time" | "exhausted" | "pages" | "ratelimit" | "error";
  error?: string;
}

// One seeding run of about `budgetMs` (a scout already in flight finishes past
// it). "busy" when another run holds the lock; throws only if Redis is missing.
export async function seedRun(budgetMs: number): Promise<SeedReport | "busy"> {
  const r = redis;
  if (!r) throw new Error("Seeding needs Redis (REDIS_URL).");
  const lockSeconds = Math.ceil(budgetMs / 1000) + 60;
  if ((await r.set(LOCK, "1", "EX", lockSeconds, "NX")) !== "OK") return "busy";

  const deadline = Date.now() + budgetMs;
  let scouted = 0;
  let failed = 0;
  let pages = 0;
  let stopped: SeedReport["stopped"] = "time";
  let error: string | undefined;

  try {
    while (Date.now() < deadline) {
      const batch = (await r.lpop(QUEUE, PARALLEL)) ?? [];
      if (!batch.length) {
        if (pages >= PAGES_PER_RUN) {
          stopped = "pages";
          break;
        }
        pages++;
        const cursor = await r.get(CURSOR);
        const atMost = cursor === null ? null : Number(cursor);
        if (atMost !== null && atMost < 0) {
          stopped = "exhausted";
          break;
        }
        const page = await followerRankPage(atMost);
        if (page.lowest === null) {
          await r.set(CURSOR, "-1");
          stopped = "exhausted";
          break;
        }
        const fresh = await unrecorded(page.logins);
        if (fresh.length) await r.rpush(QUEUE, ...fresh);
        // Strictly below the page's lowest count, so the next page can't repeat it.
        // Users tied at that count past the page's end are skipped.
        await r.set(CURSOR, String(page.lowest - 1));
        continue;
      }

      const results = await Promise.allSettled(batch.map((login) => scoutCard(login)));
      const limited = batch.filter(
        (_, i) => results[i].status === "rejected" && (results[i].reason as GithubError).type === "ratelimit",
      );
      const ok = results.filter((x) => x.status === "fulfilled").length;
      scouted += ok;
      failed += results.length - ok - limited.length; // not found, GitHub errors: dropped, not retried
      if (limited.length) {
        await r.lpush(QUEUE, ...limited); // back to the front, for the next run
        stopped = "ratelimit";
        break;
      }
    }
  } catch (e) {
    const err = e as GithubError;
    stopped = err.type === "ratelimit" ? "ratelimit" : "error";
    error = err.message ?? String(e);
  } finally {
    await r.del(LOCK);
  }

  return { scouted, failed, queued: await r.llen(QUEUE), stopped, ...(error ? { error } : null) };
}
