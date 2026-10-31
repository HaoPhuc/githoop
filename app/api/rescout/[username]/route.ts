import { type GithubError } from "@/lib/github/client";
import { pickFlag } from "@/lib/flagPriority";
import { rescoutCard, scoutErrorStatus } from "@/lib/scout";

// POST /api/rescout/<user>: rebuild the card now instead of waiting out the
// cache. 200 with the fresh card (GitHub-derived flag; the client keeps a manual
// pick), 429 with retryAfter seconds while the per-profile cooldown holds.
export async function POST(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  try {
    const res = await rescoutCard(username);
    if ("retryAfter" in res) {
      return Response.json(
        { retryAfter: res.retryAfter },
        { status: 429, headers: { "Retry-After": String(res.retryAfter) } },
      );
    }
    return Response.json({ ...res.card, country: pickFlag(null, res.card.country) ?? "" });
  } catch (e) {
    const err = e as GithubError;
    return Response.json(
      { error: err.message ?? "Failed to re-scout that profile." },
      { status: scoutErrorStatus(err.type) },
    );
  }
}
