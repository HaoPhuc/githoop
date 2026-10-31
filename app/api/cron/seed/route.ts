import { redis } from "@/lib/redis";
import { seedRun } from "@/lib/seed";

// GET /api/cron/seed: one seeding run (lib/seed), scouting the next players down
// GitHub's follower ranking into the leaderboard. Vercel Cron calls it daily
// (vercel.json) with `Authorization: Bearer $CRON_SECRET`; the same header lets
// you run it by hand to seed faster. Without CRON_SECRET the route stays shut.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // the Hobby plan's ceiling, and Vercel Cron only fires once a day there

const BUDGET_MS = 250_000; // leaves room under maxDuration for the last scouts in flight

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!redis) return Response.json({ error: "Seeding needs REDIS_URL." }, { status: 503 });
  if (!process.env.GITHUB_TOKEN && !process.env.GITHUB_TOKENS) {
    return Response.json({ error: "Seeding needs a GitHub token." }, { status: 503 });
  }

  const report = await seedRun(BUDGET_MS);
  if (report === "busy") return Response.json({ error: "A seeding run is already going." }, { status: 409 });
  return Response.json(report);
}
