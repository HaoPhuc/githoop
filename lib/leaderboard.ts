import { normalizeCountry } from "./countries";

// The /leaderboard page's pure side: query parsing, page math and links. Kept
// apart from the registry (server-only) so it's unit-testable and the client
// controls can build the same URLs the server reads.

export const PAGE_SIZE = 50;

/** A player's place on a board: 1-based rank and the board's size. */
export interface BoardRank {
  rank: number;
  total: number;
}

export interface BoardQuery {
  page: number; // 1-based, as asked for; resolvePage holds it to the board
  country: string | null; // a flag code we ship, or null for the world board
  player: string | null; // a GitHub-shaped login, without the @
}

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v);

// GitHub's login rule (as in lib/github/client): 1-39 alphanumerics or hyphens.
const LOGIN = /^(?=.*[a-z\d])[a-z\d-]{1,39}$/i;

// Anything but a plain positive integer is page 1, never an error page.
export function parsePage(v: Param): number {
  const s = first(v)?.trim() ?? "";
  if (!/^\d{1,9}$/.test(s)) return 1;
  return Math.max(1, Number(s));
}

// Unknown codes fall back to the world board rather than an empty one.
export const parseCountry = (v: Param): string | null => normalizeCountry(first(v)?.trim());

export function parsePlayer(v: Param): string | null {
  const s = first(v)?.trim().replace(/^@/, "") ?? "";
  return LOGIN.test(s) ? s : null;
}

export function parseQuery(params: Record<string, Param>): BoardQuery {
  return { page: parsePage(params.page), country: parseCountry(params.country), player: parsePlayer(params.player) };
}

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));
export const pageOfRank = (rank: number) => Math.ceil(rank / PAGE_SIZE);
export const pageOffset = (page: number) => (page - 1) * PAGE_SIZE;

// The page to show: a ranked searched player's own page, else the asked-for
// page held to the board, so a stale ?page=99 lands on the last page.
export function resolvePage(requested: number, total: number, playerRank?: number | null): number {
  if (playerRank) return pageOfRank(playerRank);
  return Math.min(Math.max(1, requested), pageCount(total));
}

// A board URL carrying only the non-default params, in a stable order.
export function boardHref({ page, country, player }: Partial<BoardQuery> = {}): string {
  const q = new URLSearchParams();
  if (country) q.set("country", country);
  if (player) q.set("player", player);
  if (page && page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/leaderboard?${s}` : "/leaderboard";
}

// Podium metals for 1-3, a quieter highlight for the rest of the top 10.
export type RankTier = "gold" | "silver" | "bronze" | "top10" | null;
export function rankTier(rank: number): RankTier {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return rank >= 4 && rank <= 10 ? "top10" : null;
}

// The anchor id of a player's row, so ?player= (or a #hash) can land on it.
export const rowId = (login: string) => `player-${login.toLowerCase()}`;

// GitHub serves avatars at any size via ?s=; the registry keeps the card's
// 480px one, far more than a 40px row needs, fifty times a page.
export function avatarAt(url: string, px: number): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "avatars.githubusercontent.com") return url;
    u.searchParams.set("s", String(px));
    return u.toString();
  } catch {
    return url;
  }
}

// "12,340": fixed locale so the server and client print the same digits.
export const formatRank = (n: number) => n.toLocaleString("en-US");
