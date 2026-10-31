import { beforeEach, describe, expect, it, vi } from "vitest";

// The merge rules: who can merge with whom, the bio proof, and splitting again.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/github/client", () => ({ isValidLogin: (l: string) => /^[a-z\d-]{1,39}$/i.test(l) }));

const bios = new Map<string, string>();
const accountBio = vi.fn(async (login: string) => bios.get(login) ?? null);
vi.mock("@/lib/github/search", () => ({ accountBio: (l: string) => accountBio(l) }));

const strings = new Map<string, string>();
const hashes = new Map<string, Map<string, string>>();
const hash = (k: string) => hashes.get(k) ?? (hashes.set(k, new Map()), hashes.get(k)!);

let useRedis = true;
const fake = {
  get: async (k: string) => strings.get(k) ?? null,
  set: async (k: string, v: string, ...opts: unknown[]) => {
    if (opts.includes("NX") && strings.has(k)) return null;
    strings.set(k, v);
    return "OK";
  },
  hget: async (k: string, f: string) => hash(k).get(f) ?? null,
  multi() {
    const ops: (() => void)[] = [];
    const tx = {
      del: (k: string) => (ops.push(() => strings.delete(k)), tx),
      hset: (k: string, f: string, v: string) => (ops.push(() => hash(k).set(f, v)), tx),
      hdel: (k: string, f: string) => (ops.push(() => hash(k).delete(f)), tx),
      exec: async () => ops.forEach((op) => op()),
    };
    return tx;
  },
};
vi.mock("@/lib/redis", () => ({
  get redis() {
    return useRedis ? fake : null;
  },
}));

import { altsOf, confirmMerge, mainAccountOf, MAX_ALTS, startMerge } from "@/lib/merge";

const started = async (main: string, alt: string) => {
  const res = await startMerge(main, alt);
  if ("error" in res) throw new Error(res.error);
  return res;
};

// A full merge: the code goes in both bios and the check passes.
const merge = async (main: string, alt: string) => {
  const { code } = await started(main, alt);
  bios.set(main, code);
  bios.set(alt, code);
  return confirmMerge(main, alt);
};

beforeEach(() => {
  strings.clear();
  hashes.clear();
  bios.clear();
  accountBio.mockClear();
  useRedis = true;
});

describe("startMerge", () => {
  it("hands out a code short enough for a bio", async () => {
    const res = await started("Main", "@Alt");
    expect(res).toMatchObject({ mode: "merge", main: "main", alt: "alt" });
    expect(res.code).toMatch(/^githoop-[0-9a-f]{8}$/);
  });

  it("keeps the same code on a reload, so a bio already edited stays good", async () => {
    expect((await started("main", "alt")).code).toBe((await started("main", "alt")).code);
  });

  it("gives each pair its own code", async () => {
    expect((await started("main", "alt")).code).not.toBe((await started("main", "other")).code);
  });

  it("refuses the same account twice and impossible names", async () => {
    expect(await startMerge("main", "MAIN")).toHaveProperty("error");
    expect(await startMerge("main", "not a name")).toHaveProperty("error");
  });

  it("needs Redis", async () => {
    useRedis = false;
    expect(await startMerge("main", "alt")).toHaveProperty("error");
  });

  it("doesn't call GitHub", async () => {
    await started("main", "alt");
    expect(accountBio).not.toHaveBeenCalled();
  });
});

describe("confirmMerge", () => {
  it("merges once both bios show the code", async () => {
    expect(await merge("main", "alt")).toEqual({ done: "merge", main: "main", alt: "alt" });
    expect(await mainAccountOf("alt")).toBe("main");
    expect(await mainAccountOf("main")).toBe("main");
    expect(await altsOf("main")).toEqual(["alt"]);
  });

  it("accepts the code anywhere in a bio", async () => {
    const { code } = await started("main", "alt");
    bios.set("main", `Coding from Hanoi ${code}`);
    bios.set("alt", `${code} and more`);
    expect(await confirmMerge("main", "alt")).toHaveProperty("done", "merge");
  });

  it("names the accounts still missing the code, and merges nothing", async () => {
    const { code } = await started("main", "alt");
    bios.set("main", code);
    bios.set("alt", "just a bio");
    expect(await confirmMerge("main", "alt")).toEqual({ missing: ["alt"] });
    bios.set("main", "");
    expect(await confirmMerge("main", "alt")).toEqual({ missing: ["main", "alt"] });
    expect(await mainAccountOf("alt")).toBe("alt");
  });

  it("can't merge someone else's account: one bio isn't enough", async () => {
    const { code } = await started("attacker", "torvalds");
    bios.set("attacker", code);
    bios.set("torvalds", "Linux");
    expect(await confirmMerge("attacker", "torvalds")).toEqual({ missing: ["torvalds"] });
  });

  it("rejects a code meant for another pair", async () => {
    const { code } = await started("main", "alt");
    await started("main", "other");
    bios.set("main", code);
    bios.set("other", code);
    expect(await confirmMerge("main", "other")).toEqual({ missing: ["main", "other"] });
  });

  it("needs a live code, and doesn't call GitHub without one", async () => {
    expect(await confirmMerge("main", "alt")).toHaveProperty("error");
    expect(accountBio).not.toHaveBeenCalled();
  });

  it("uses a code once", async () => {
    await merge("main", "alt");
    expect(await confirmMerge("main", "alt")).toHaveProperty("error");
  });

  it("reports an account that doesn't exist", async () => {
    const { code } = await started("main", "ghost");
    bios.set("main", code);
    expect(await confirmMerge("main", "ghost")).toEqual({ error: "There's no GitHub account called @ghost." });
  });

  it("lets GitHub errors through for the route to report", async () => {
    await started("main", "alt");
    accountBio.mockRejectedValueOnce({ type: "ratelimit", message: "limited" });
    await expect(confirmMerge("main", "alt")).rejects.toMatchObject({ type: "ratelimit" });
  });
});

describe("merge rules", () => {
  it("allows several accounts up to the limit", async () => {
    for (let i = 0; i < MAX_ALTS; i++) await merge("main", `alt${i}`);
    expect(await altsOf("main")).toHaveLength(MAX_ALTS);
    expect(await startMerge("main", "onemore")).toHaveProperty("error");
  });

  it("won't take an account already merged elsewhere", async () => {
    await merge("main", "alt");
    expect(await startMerge("second", "alt")).toEqual({ error: "@alt is already merged into @main." });
  });

  it("stays one level deep", async () => {
    await merge("main", "alt");
    expect(await startMerge("alt", "third")).toHaveProperty("error"); // alt can't be a main
    expect(await startMerge("second", "main")).toHaveProperty("error"); // a main can't be merged in
  });
});

describe("splitting", () => {
  it("offers a split for a merged pair, with the same proof", async () => {
    await merge("main", "alt");
    const { mode, code } = await started("main", "alt");
    expect(mode).toBe("split");

    bios.set("main", code);
    bios.set("alt", "no code");
    expect(await confirmMerge("main", "alt")).toEqual({ missing: ["alt"] });

    bios.set("alt", code);
    expect(await confirmMerge("main", "alt")).toEqual({ done: "split", main: "main", alt: "alt" });
    expect(await mainAccountOf("alt")).toBe("alt");
    expect(await altsOf("main")).toEqual([]);
  });

  it("keeps the main account's other merges", async () => {
    await merge("main", "one");
    await merge("main", "two");
    await merge("main", "one"); // the second round for a merged pair is a split
    expect(await altsOf("main")).toEqual(["two"]);
    expect(await mainAccountOf("two")).toBe("main");
  });
});

describe("reads without Redis", () => {
  it("treats every account as its own", async () => {
    useRedis = false;
    expect(await mainAccountOf("alt")).toBe("alt");
    expect(await altsOf("main")).toEqual([]);
  });
});
