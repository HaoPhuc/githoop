import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercises the real club-mode GitHub layer against a scripted fetch: the one org
// GraphQL query (through the client's queryLogin), the REST contributor lists and
// every way one of them can fail. Fake tokens, no Redis, no network.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/redis", () => ({ redis: null }));

import { aggregateContributors, fetchOrg, isOrganization } from "@/lib/github/org";
import { hashLogin } from "@/lib/github/tokens";

const POOL = ["tokA", "tokB"];
const GRAPHQL = "https://api.github.com/graphql";

const node = (name: string, stars: number, language: string | null = "Go") => ({
  name,
  description: `${name} repo`,
  stargazerCount: stars,
  forkCount: 2,
  primaryLanguage: language ? { name: language } : null,
  pushedAt: "2026-10-01T00:00:00Z",
  isArchived: false,
});

const ORG = {
  login: "acme",
  name: "Acme",
  avatarUrl: "https://example.com/acme.png",
  description: "We build things",
  location: "Berlin, Germany",
  createdAt: "2015-01-01T00:00:00Z",
  repositories: {
    totalCount: 8,
    nodes: [900, 800, 700, 600, 500, 400, 300, 200].map((s, i) => node(`r${i + 1}`, s)),
  },
  recent: { nodes: [{ pushedAt: "2026-10-20T00:00:00Z" }, { pushedAt: null }] },
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const gqlOk = (user: unknown) => json({ data: { user } });
const notFound = () =>
  json({ data: { user: null }, errors: [{ type: "NOT_FOUND", message: "Could not resolve to an Organization." }] });
const human = (login: string, contributions: number) => ({ login, avatar_url: `https://a/${login}`, type: "User", contributions });

type Call = { url: string; token: string; body: string };
let calls: Call[] = [];
function scriptFetch(respond: (url: string, body: string, token: string) => Response | Promise<Response>) {
  const mock = vi.fn(async (url: unknown, init?: RequestInit) => {
    const token = String((init?.headers as Record<string, string>).Authorization).replace("Bearer ", "");
    const body = String(init?.body ?? "");
    calls.push({ url: String(url), token, body });
    return respond(String(url), body, token);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

// The repo name of a REST contributors call.
const repoOf = (url: string) => url.match(/\/repos\/acme\/([^/]+)\/contributors/)?.[1];
const restCalls = () => calls.filter((c) => c.url !== GRAPHQL);

beforeEach(() => {
  calls = [];
  vi.stubEnv("GITHUB_TOKENS", POOL.join(","));
  vi.stubEnv("GITHUB_TOKEN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchOrg", () => {
  it("reads the org in one query and the contributors of its six most-starred repos", async () => {
    scriptFetch((url) => {
      if (url === GRAPHQL) return gqlOk(ORG);
      const repo = repoOf(url);
      if (repo === "r1") return json([human("ada", 50), human("Bob", 10), { login: "dependabot[bot]", type: "Bot", contributions: 99 }]);
      if (repo === "r2") return json([human("bob", 45), { login: "renovate", type: "Bot", contributions: 70 }]);
      if (repo === "r3") return json([{ login: "ci[bot]", type: "User", contributions: 80 }, human("cy", 5)]);
      return json([]);
    });

    const payload = await fetchOrg("@Acme");

    const gql = calls.filter((c) => c.url === GRAPHQL);
    expect(gql).toHaveLength(1);
    expect(gql[0].body).toContain("user: organization(login: $login)");
    expect(gql[0].body).toContain("privacy: PUBLIC, isFork: false");
    expect(JSON.parse(gql[0].body).variables).toEqual({ login: "Acme" });

    // Only the six most-starred repos, 30 contributors each, on the login's pool token.
    expect(restCalls().map((c) => repoOf(c.url))).toEqual(["r1", "r2", "r3", "r4", "r5", "r6"]);
    for (const c of restCalls()) {
      expect(c.url).toContain("per_page=30");
      expect(c.token).toBe(POOL[hashLogin("acme") % POOL.length]);
    }

    // Aggregated per login (case-insensitively), bots dropped, most commits first.
    expect(payload.contributors).toEqual([
      { login: "Bob", avatarUrl: "https://a/Bob", contributions: 55, repos: 2 },
      { login: "ada", avatarUrl: "https://a/ada", contributions: 50, repos: 1 },
      { login: "cy", avatarUrl: "https://a/cy", contributions: 5, repos: 1 },
    ]);
    expect(payload).toMatchObject({
      login: "acme",
      publicRepos: 8,
      recentPushes: ["2026-10-20T00:00:00Z"],
      sampledRepos: ["r1", "r2", "r3", "r4", "r5", "r6"],
      contributorsComplete: true,
    });
    expect(payload.repos).toHaveLength(8);
    expect(payload.repos[0]).toEqual({
      name: "r1",
      description: "r1 repo",
      stars: 900,
      forks: 2,
      language: "Go",
      pushedAt: "2026-10-01T00:00:00Z",
      archived: false,
    });
  });

  it("skips repos it can't read without failing the club, flagging only transient skips", async () => {
    scriptFetch((url) => {
      if (url === GRAPHQL) return gqlOk(ORG);
      switch (repoOf(url)) {
        case "r1":
          return new Response(null, { status: 204 }); // empty repo: read, no one in it
        case "r2":
          return json({}, 202); // still computing: transient
        case "r3":
          return json({ message: "The history or contributor list is too large" }, 403, { "x-ratelimit-remaining": "4000" });
        case "r4":
          return json({ message: "boom" }, 500); // transient
        case "r5":
          throw new TypeError("fetch failed"); // network: transient
        default:
          return json([human("ada", 3)]);
      }
    });

    const payload = await fetchOrg("acme");
    expect(payload.contributors.map((c) => c.login)).toEqual(["ada"]);
    expect(payload.sampledRepos).toEqual(["r1", "r6"]);
    expect(payload.contributorsComplete).toBe(false);
  });

  it("stays complete when every skip is final (too large to list, gone)", async () => {
    scriptFetch((url) => {
      if (url === GRAPHQL) return gqlOk(ORG);
      if (repoOf(url) === "r1") return json({ message: "too large" }, 403);
      if (repoOf(url) === "r2") return json({ message: "Not Found" }, 404);
      return json([human("ada", 3)]);
    });
    const payload = await fetchOrg("acme");
    expect(payload.sampledRepos).toEqual(["r3", "r4", "r5", "r6"]);
    expect(payload.contributorsComplete).toBe(true);
  });

  it("reads a 403 with an exhausted quota or Retry-After as a rate limit (transient)", async () => {
    const limited: Record<string, string>[] = [{ "x-ratelimit-remaining": "0" }, { "retry-after": "60" }];
    for (const headers of limited) {
      calls = [];
      scriptFetch((url) => {
        if (url === GRAPHQL) return gqlOk(ORG);
        if (repoOf(url) === "r1") return json({ message: "API rate limit exceeded" }, 403, headers);
        return json([human("ada", 3)]);
      });
      const payload = await fetchOrg("acme");
      expect(payload.contributorsComplete).toBe(false);
      expect(payload.contributors).toHaveLength(1);
    }
  });

  it("handles an org with no public repos", async () => {
    scriptFetch(() => gqlOk({ ...ORG, repositories: { totalCount: 0, nodes: [] }, recent: { nodes: [] } }));
    const payload = await fetchOrg("acme");
    expect(restCalls()).toHaveLength(0);
    expect(payload).toMatchObject({ publicRepos: 0, repos: [], contributors: [], sampledRepos: [], contributorsComplete: true });
  });

  it("is notfound for a login that isn't an organization, before any REST call", async () => {
    scriptFetch(() => notFound());
    await expect(fetchOrg("someuser")).rejects.toMatchObject({ type: "notfound" });
    expect(restCalls()).toHaveLength(0);
  });

  it("fails over to another pool token when the org query is rate-limited", async () => {
    const primary = POOL[hashLogin("acme") % POOL.length];
    scriptFetch((url, _body, token) => {
      if (url !== GRAPHQL) return json([]);
      if (token === primary) return json({ message: "rate limited" }, 403, { "x-ratelimit-remaining": "0" });
      return gqlOk(ORG);
    });
    await expect(fetchOrg("acme")).resolves.toMatchObject({ login: "acme" });
    expect(calls.filter((c) => c.url === GRAPHQL).map((c) => c.token)).toEqual([primary, POOL.find((t) => t !== primary)]);
  });

  it("rejects an impossible name, and a missing token, before any call", async () => {
    const mock = scriptFetch(() => gqlOk(ORG));
    await expect(fetchOrg("foo bar")).rejects.toMatchObject({ type: "invalid" });
    vi.stubEnv("GITHUB_TOKENS", "");
    await expect(fetchOrg("acme")).rejects.toMatchObject({ type: "config" });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("isOrganization", () => {
  it("is true for an organization and false for a user", async () => {
    scriptFetch((_url, body) => (body.includes('"login":"vercel"') ? gqlOk({ login: "vercel" }) : notFound()));
    await expect(isOrganization("vercel")).resolves.toBe(true);
    await expect(isOrganization("someuser")).resolves.toBe(false);
    expect(calls.every((c) => c.body.includes("query IsOrg("))).toBe(true);
  });

  it("is false on any failure, and for an impossible name without a call", async () => {
    const mock = scriptFetch(() => json({ message: "Bad credentials" }, 401));
    await expect(isOrganization("vercel")).resolves.toBe(false);
    expect(mock).toHaveBeenCalledTimes(1);
    mock.mockClear();
    await expect(isOrganization("not a login")).resolves.toBe(false);
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("aggregateContributors", () => {
  it("sums per login, counts repos, drops bots and anonymous rows, and orders deterministically", () => {
    const out = aggregateContributors([
      [human("zed", 10), human("amy", 10), { type: "Anonymous", contributions: 500 }],
      [human("AMY", 0), human("zed", 0), human("kit", 10), { login: "github-actions[bot]", type: "Bot", contributions: 9 }],
    ]);
    // amy and zed tie on commits and repos: login order breaks it; kit has one repo.
    expect(out.map((c) => [c.login, c.contributions, c.repos])).toEqual([
      ["amy", 10, 2],
      ["zed", 10, 2],
      ["kit", 10, 1],
    ]);
  });
});
