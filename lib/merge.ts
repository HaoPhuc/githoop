import "server-only";
import { randomBytes } from "node:crypto";
import { isValidLogin } from "./github/client";
import { accountBio } from "./github/search";
import { redis } from "./redis";

// Merged accounts: one person's GitHub accounts playing as one card. The site has
// no logins, so ownership is proved with a code: only the owner of an account can
// put it in that account's bio, and both accounts must show it. The same proof
// splits a merge again.
//
// A merge has one main account and up to MAX_ALTS others. The others stop being
// players: lib/scout builds the main card from all of them and answers for them
// with it. One level only: a main account can't itself be merged into another.
//
// Redis is required to merge, but reads are best-effort like the card cache: an
// outage just means accounts play separately until it's back.

const V = "v1";
const MAIN_OF = `githoop:merge:${V}:main`; // hash: other account -> its main account
const ALTS_OF = `githoop:merge:${V}:alts`; // hash: main account -> JSON list of the others
const codeKey = (main: string, alt: string) => `githoop:merge:${V}:code:${main}:${alt}`;

export const CODE_TTL_SECONDS = 30 * 60;
export const MAX_ALTS = 3;

export type MergeMode = "merge" | "split";

export type MergeStart = { mode: MergeMode; main: string; alt: string; code: string } | { error: string };

export type MergeConfirm =
  | { done: MergeMode; main: string; alt: string }
  | { missing: string[] } // accounts whose bio doesn't show the code yet
  | { error: string };

const normalize = (login: string) => login.trim().replace(/^@/, "").toLowerCase();
const parseAlts = (raw: string | null) => (raw ? (JSON.parse(raw) as string[]) : []);

// The account that plays for `login`: itself unless it's merged into another.
export async function mainAccountOf(login: string): Promise<string> {
  if (!redis) return login;
  try {
    return (await redis.hget(MAIN_OF, login)) ?? login;
  } catch (e) {
    console.error("[merge] read failed:", (e as Error).message);
    return login;
  }
}

// The other accounts merged into a main account.
export async function altsOf(main: string): Promise<string[]> {
  if (!redis) return [];
  try {
    return parseAlts(await redis.hget(ALTS_OF, main));
  } catch (e) {
    console.error("[merge] read failed:", (e as Error).message);
    return [];
  }
}

// What this pair of accounts can do: merge, split an existing merge, or neither.
async function modeFor(main: string, alt: string): Promise<{ mode: MergeMode } | { error: string }> {
  if (main === alt) return { error: "Those are the same account." };
  if (!isValidLogin(main) || !isValidLogin(alt)) return { error: "That doesn't look like a GitHub username." };
  const [altMain, mainMain, alts, altAlts] = await Promise.all([
    mainAccountOf(alt),
    mainAccountOf(main),
    altsOf(main),
    altsOf(alt),
  ]);
  if (altMain === main) return { mode: "split" };
  if (altMain !== alt) return { error: `@${alt} is already merged into @${altMain}.` };
  if (mainMain !== main) return { error: `@${main} is merged into @${mainMain}, so use that as the main account.` };
  if (altAlts.length) return { error: `@${alt} is the main account of its own merge. Split that first.` };
  if (alts.length >= MAX_ALTS) return { error: `@${main} already has ${MAX_ALTS} merged accounts.` };
  return { mode: "merge" };
}

// The code for this pair: short enough to paste into a bio, and the same one on
// a reload until it expires, so refreshing can't invalidate a bio already edited.
export async function startMerge(rawMain: string, rawAlt: string): Promise<MergeStart> {
  if (!redis) return { error: "Merging isn't available right now." };
  const main = normalize(rawMain);
  const alt = normalize(rawAlt);
  const check = await modeFor(main, alt);
  if ("error" in check) return check;

  const key = codeKey(main, alt);
  const fresh = `githoop-${randomBytes(4).toString("hex")}`;
  await redis.set(key, fresh, "EX", CODE_TTL_SECONDS, "NX");
  const code = (await redis.get(key)) ?? fresh;
  return { mode: check.mode, main, alt, code };
}

// Checks both bios and, when both show the code, applies the merge or split.
// Throws a GithubError when GitHub can't be read.
export async function confirmMerge(rawMain: string, rawAlt: string): Promise<MergeConfirm> {
  if (!redis) return { error: "Merging isn't available right now." };
  const main = normalize(rawMain);
  const alt = normalize(rawAlt);
  const key = codeKey(main, alt);
  const code = await redis.get(key);
  if (!code) return { error: "That code has expired. Start again for a new one." };

  const check = await modeFor(main, alt);
  if ("error" in check) return check;

  const logins = [main, alt];
  const bios = await Promise.all(logins.map(accountBio));
  const gone = logins.find((_, i) => bios[i] === null);
  if (gone) return { error: `There's no GitHub account called @${gone}.` };
  const missing = logins.filter((_, i) => !bios[i]?.includes(code));
  if (missing.length) return { missing };

  const alts = await altsOf(main);
  const tx = redis.multi().del(key);
  if (check.mode === "merge") {
    tx.hset(MAIN_OF, alt, main).hset(ALTS_OF, main, JSON.stringify([...alts, alt]));
  } else {
    const left = alts.filter((a) => a !== alt);
    tx.hdel(MAIN_OF, alt);
    if (left.length) tx.hset(ALTS_OF, main, JSON.stringify(left));
    else tx.hdel(ALTS_OF, main);
  }
  await tx.exec();
  return { done: check.mode, main, alt };
}
