import "server-only";
import type { GithubError } from "./client";
import { tokenPool } from "./tokens";

// GitHub's follower ranking, for seeding the player registry (lib/seed). REST
// search, which has its own rate limit (30 requests/min) apart from the GraphQL
// points the scouts spend.
//
// A search query stops at 1,000 results, so the ranking isn't paged: each call
// asks for the most followed users at or below a follower count, and the caller
// continues below the lowest count it got back.

const API = "https://api.github.com";

export interface RankPage {
  logins: string[]; // most followed first; users only, never organizations
  lowest: number | null; // follower count of the page's last user; null when the page is empty
}

async function get<T>(path: string): Promise<T> {
  const token = tokenPool()[0]?.token;
  if (!token) throw { type: "config", message: "Server is missing a GitHub token." } satisfies GithubError;
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 429) {
    throw { type: "ratelimit", message: "GitHub search rate limit hit." } satisfies GithubError;
  }
  if (res.status === 404) throw { type: "notfound", message: "Not on GitHub." } satisfies GithubError;
  if (!res.ok) throw { type: "network", message: `GitHub search failed (${res.status}).` } satisfies GithubError;
  return (await res.json()) as T;
}

// The `size` most followed users with at most `atMost` followers (no ceiling
// when null).
export async function followerRankPage(atMost: number | null, size = 100): Promise<RankPage> {
  const q = atMost === null ? "type:user followers:>=1" : `type:user followers:<=${atMost}`;
  const page = await get<{ items: { login: string; type: string }[] }>(
    `/search/users?q=${encodeURIComponent(q)}&sort=followers&order=desc&per_page=${size}`,
  );
  const logins = page.items.filter((u) => u.type === "User").map((u) => u.login);
  if (!logins.length) return { logins, lowest: null };
  // Search results don't carry follower counts; the last user's profile does.
  const last = await get<{ followers: number }>(`/users/${encodeURIComponent(logins[logins.length - 1])}`);
  return { logins, lowest: last.followers };
}

// An account's bio, "" when it has none, or null when there's no such account.
export async function accountBio(login: string): Promise<string | null> {
  try {
    const user = await get<{ bio: string | null }>(`/users/${encodeURIComponent(login)}`);
    return user.bio ?? "";
  } catch (e) {
    if ((e as GithubError).type === "notfound") return null;
    throw e;
  }
}
