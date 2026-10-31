import "server-only";
import { isValidLogin, queryLogin, type GithubError, type GithubErrorType } from "./client";
import { pickToken } from "./tokens";

// Server-only GitHub layer for club mode: a GitHub organization becomes a club.
// One GraphQL query reads the org and its public, non-fork repos (through the
// client's machinery, so retries, token health and failover all apply); then the
// REST contributors list of the most-starred repos gives the squad candidates.
// GraphQL has no contributors field, so REST is the only cheap way to get them.
//
// Contributor lists are best-effort per repo: a repo that fails, is empty, is
// still being computed (202) or is too large to list (403) is skipped, never the
// whole club. `contributorsComplete` tells the caller whether a skip was
// transient (rate limit, network, 202), so a degraded build isn't cached long.

export interface OrgRepo {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  pushedAt: string;
  archived: boolean;
}

export interface OrgContributor {
  login: string;
  avatarUrl: string;
  contributions: number; // commits, summed over the sampled repos
  repos: number; // how many of the sampled repos list them
}

export interface OrgPayload {
  login: string;
  name: string | null;
  avatarUrl: string;
  description: string | null;
  location: string | null;
  createdAt: string;
  publicRepos: number; // public, non-fork
  repos: OrgRepo[]; // top 100 by stars
  recentPushes: string[]; // pushedAt of the 100 most recently pushed repos (the activity signal)
  contributors: OrgContributor[]; // humans across the sampled repos, most commits first
  sampledRepos: string[]; // the repos whose contributors were read
  contributorsComplete: boolean; // false when a sampled repo was skipped for a transient reason
}

// The top repos by stars whose contributors make up the squad pool.
export const CONTRIBUTOR_REPOS = 6;
const CONTRIBUTORS_PER_REPO = 30;
const REST = "https://api.github.com";
// Same backstop as the GraphQL client: below Vercel's ~10s function cap.
const REQUEST_TIMEOUT_MS = 8_000;

const fail = (type: GithubErrorType, message: string): never => {
  throw { type, message } satisfies GithubError;
};

interface RepoNode {
  name: string;
  description: string | null;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: { name: string } | null;
  pushedAt: string | null; // null for a repo that was never pushed to
  isArchived: boolean;
}

interface OrgNode {
  login: string;
  name: string | null;
  avatarUrl: string;
  description: string | null;
  location: string | null;
  createdAt: string;
  repositories: { totalCount: number; nodes: RepoNode[] };
  recent: { nodes: { pushedAt: string | null }[] };
}

// The root field is aliased to `user` for queryLogin (see lib/github/client).
// `recent` orders the same repos by push date, so the activity count isn't
// limited to the starred ones.
const ORG_QUERY = `
  query Org($login: String!) {
    user: organization(login: $login) {
      login
      name
      avatarUrl(size: 480)
      description
      location
      createdAt
      repositories(first: 100, privacy: PUBLIC, isFork: false, orderBy: { field: STARGAZERS, direction: DESC }) {
        totalCount
        nodes { name description stargazerCount forkCount primaryLanguage { name } pushedAt isArchived }
      }
      recent: repositories(first: 100, privacy: PUBLIC, isFork: false, orderBy: { field: PUSHED_AT, direction: DESC }) {
        nodes { pushedAt }
      }
    }
  }`;

const IS_ORG_QUERY = `
  query IsOrg($login: String!) {
    user: organization(login: $login) { login }
  }`;

const normalize = (login: string) => login.trim().replace(/^@/, "");

interface RestContributor {
  login?: string;
  avatar_url?: string;
  type?: string;
  contributions?: number;
}

const isBot = (c: RestContributor) => c.type === "Bot" || /\[bot\]$/i.test(c.login ?? "");

type ContributorsResult = { ok: true; list: RestContributor[] } | { ok: false; transient: boolean };

// One repo's top contributors. Never throws: every failure is a skip, marked
// transient when a later build could succeed.
async function repoContributors(org: string, repo: string, token: string): Promise<ContributorsResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${REST}/repos/${org}/${encodeURIComponent(repo)}/contributors?per_page=${CONTRIBUTORS_PER_REPO}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: ctrl.signal,
      },
    );
    // 204: an empty repo. 202: GitHub is still computing the list.
    if (res.status === 204) return { ok: true, list: [] };
    if (res.status === 202) return { ok: false, transient: true };
    // A 403 is a rate limit only when the headers say so; otherwise it's GitHub
    // refusing a history too large to list, which won't change on a retry. The
    // token's health isn't recorded or benched here: those track the GraphQL
    // quota, and REST has its own.
    if (res.status === 429) return { ok: false, transient: true };
    if (res.status === 403) {
      const limited = res.headers.get("x-ratelimit-remaining") === "0" || res.headers.has("retry-after");
      return { ok: false, transient: limited };
    }
    if (res.status === 404) return { ok: false, transient: false };
    if (!res.ok) return { ok: false, transient: true };
    const body: unknown = await res.json();
    return { ok: true, list: Array.isArray(body) ? (body as RestContributor[]) : [] };
  } catch {
    return { ok: false, transient: true }; // network failure or timeout
  } finally {
    clearTimeout(timer);
  }
}

// Humans across the sampled repos, aggregated per login: commits summed, repos
// counted. Most commits first, then the widest footprint, then login.
export function aggregateContributors(lists: RestContributor[][]): OrgContributor[] {
  const byLogin = new Map<string, OrgContributor>();
  for (const list of lists) {
    for (const c of list) {
      if (!c.login || isBot(c)) continue;
      const id = c.login.toLowerCase();
      const seen = byLogin.get(id);
      if (seen) {
        seen.contributions += c.contributions ?? 0;
        seen.repos += 1;
      } else {
        byLogin.set(id, {
          login: c.login,
          avatarUrl: c.avatar_url ?? "",
          contributions: c.contributions ?? 0,
          repos: 1,
        });
      }
    }
  }
  return [...byLogin.values()].sort(
    (a, b) =>
      b.contributions - a.contributions ||
      b.repos - a.repos ||
      a.login.toLowerCase().localeCompare(b.login.toLowerCase()),
  );
}

export async function fetchOrg(login: string): Promise<OrgPayload> {
  const org = normalize(login);
  if (!isValidLogin(org)) return fail("invalid", "That doesn't look like a GitHub organization name.");

  const node = await queryLogin<OrgNode>(ORG_QUERY, org);
  if (!node) return fail("notfound", "No GitHub organization by that name.");

  const repos: OrgRepo[] = node.repositories.nodes
    .map((n) => ({
      name: n.name,
      description: n.description,
      stars: n.stargazerCount ?? 0,
      forks: n.forkCount ?? 0,
      language: n.primaryLanguage?.name ?? null,
      pushedAt: n.pushedAt ?? node.createdAt,
      archived: n.isArchived,
    }))
    .sort((a, b) => b.stars - a.stars);

  // queryLogin just succeeded, so the pool has a token; REST rides the same shard.
  const token = pickToken(node.login)!.token;
  const sampled = repos.slice(0, CONTRIBUTOR_REPOS).map((r) => r.name);
  const results = await Promise.all(sampled.map((repo) => repoContributors(node.login, repo, token)));

  return {
    login: node.login,
    name: node.name,
    avatarUrl: node.avatarUrl,
    description: node.description,
    location: node.location,
    createdAt: node.createdAt,
    publicRepos: node.repositories.totalCount,
    repos,
    recentPushes: node.recent.nodes.flatMap((n) => (n.pushedAt ? [n.pushedAt] : [])),
    contributors: aggregateContributors(results.flatMap((r) => (r.ok ? [r.list] : []))),
    sampledRepos: sampled.filter((_, i) => results[i].ok),
    contributorsComplete: results.every((r) => r.ok || !r.transient),
  };
}

// Whether a login is an organization: the player page's "see its club" hint
// for an org that was scouted as a user. One cheap query; any failure is "no".
export async function isOrganization(login: string): Promise<boolean> {
  const org = normalize(login);
  if (!isValidLogin(org)) return false;
  try {
    return (await queryLogin<{ login: string }>(IS_ORG_QUERY, org)) !== null;
  } catch {
    return false;
  }
}
