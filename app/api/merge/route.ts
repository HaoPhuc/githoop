import type { GithubError } from "@/lib/github/client";
import { confirmMerge, startMerge } from "@/lib/merge";
import { removePlayer } from "@/lib/registry";
import { dropCards, scoutErrorStatus } from "@/lib/scout";

// POST /api/merge { step, main, alt }: `start` hands out the bio code for a pair
// of accounts, `confirm` checks both bios and applies the merge or split (see
// lib/merge). 200 with { missing } while a bio doesn't show the code yet.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { step?: unknown; main?: unknown; alt?: unknown } | null;
  const { step, main, alt } = body ?? {};
  if (typeof main !== "string" || typeof alt !== "string" || (step !== "start" && step !== "confirm")) {
    return Response.json({ error: "Enter both accounts." }, { status: 400 });
  }

  if (step === "start") {
    const res = await startMerge(main, alt);
    return Response.json(res, { status: "error" in res ? 400 : 200 });
  }

  try {
    const res = await confirmMerge(main, alt);
    if ("error" in res) return Response.json(res, { status: 400 });
    if ("done" in res) {
      // Both accounts' cards are out of date now. The other account also leaves
      // the board on a merge; a split brings it back at its next scout.
      await dropCards([res.main, res.alt]);
      if (res.done === "merge") await removePlayer(res.alt);
    }
    return Response.json(res);
  } catch (e) {
    const err = e as GithubError;
    return Response.json({ error: err.message ?? "Couldn't read GitHub right now." }, { status: scoutErrorStatus(err.type) });
  }
}
