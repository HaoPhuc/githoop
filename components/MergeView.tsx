"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import type { MergeConfirm, MergeMode, MergeStart } from "@/lib/merge";

// The /merge flow: pick the two accounts, get a code, paste it into both bios,
// check. Entering a pair that's already merged offers to split it instead.

type Pair = { mode: MergeMode; main: string; alt: string; code: string };

const INPUT =
  "h-[44px] w-full rounded-xl border border-line bg-panel/70 px-3 text-[14px] text-ink outline-none transition focus:border-brand/60";
const BUTTON =
  "font-display h-[44px] rounded-xl bg-brand px-5 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi disabled:opacity-60";
const PANEL = "rounded-2xl border border-white/[0.06] bg-white/[0.02] p-[18px]";

async function post<T>(body: object): Promise<T> {
  const res = await fetch("/api/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

function Done({ mode, main, alt }: { mode: MergeMode; main: string; alt: string }) {
  return (
    <section className={PANEL} aria-live="polite">
      <h2 className="font-display text-[26px] leading-none">{mode === "merge" ? "Merged" : "Split"}</h2>
      <p className="mt-2 text-[14px] leading-[1.5] text-ink-soft">
        {mode === "merge"
          ? `@${alt} now plays for @${main}, and its card sends people to the merged one.`
          : `@${main} and @${alt} are separate players again.`}{" "}
        You can remove the code from both bios now.
      </p>
      <Link
        href={`/${main}`}
        className="font-display mt-4 inline-flex h-[44px] items-center rounded-xl bg-brand px-5 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi"
      >
        SEE THE CARD
      </Link>
    </section>
  );
}

function ProveIt({ pair, onBack, onDone }: { pair: Pair; onBack: () => void; onDone: () => void }) {
  const { mode, main, alt, code } = pair;
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setNote("Couldn't copy it. Select the code and copy it by hand.");
    }
  };

  const check = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await post<MergeConfirm>({ step: "confirm", main, alt });
      if ("done" in res) onDone();
      else if ("missing" in res) {
        const who = res.missing.map((l) => `@${l}`).join(" and ");
        setNote(`The code isn't in ${who}'s bio yet. It can take a minute to show after saving.`);
      } else setNote(res.error);
    } catch {
      setNote("Couldn't check right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${PANEL} flex flex-col gap-[14px]`}>
      <div className="flex items-center gap-[10px]">
        <code className="min-w-0 flex-1 truncate rounded-xl border border-line bg-panel px-3 py-[10px] font-mono text-[15px] text-ink">
          {code}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy the code"
          className="flex h-[44px] w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line text-ink-soft transition hover:text-brand"
        >
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        </button>
      </div>
      <ol className="flex list-decimal flex-col gap-[6px] pl-[20px] text-[14px] leading-[1.5] text-ink-soft">
        <li>
          Signed in to GitHub as <strong className="text-ink">@{main}</strong>, add the code to your bio in{" "}
          <a
            href="https://github.com/settings/profile"
            target="_blank"
            rel="noopener"
            className="font-semibold text-ink underline underline-offset-2 hover:text-brand"
          >
            profile settings
          </a>{" "}
          and save.
        </li>
        <li>
          Switch to <strong className="text-ink">@{alt}</strong> and do the same.
        </li>
        <li>Come back here and press the button.</li>
      </ol>
      <p className="text-[12.5px] leading-[1.5] text-ink-mute">
        The code lasts 30 minutes. You can keep your bio as it is and just add it to the end, then remove it after.
      </p>
      {note && (
        <p role="alert" className="text-[13px] leading-[1.5] text-gold-hi">
          {note}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-[12px]">
        <button type="button" onClick={check} disabled={busy} className={`${BUTTON} cursor-pointer`}>
          {busy ? "CHECKING…" : mode === "merge" ? "CHECK AND MERGE" : "CHECK AND SPLIT"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer text-[13px] font-semibold text-ink-soft transition hover:text-brand"
        >
          Change accounts
        </button>
      </div>
    </section>
  );
}

export default function MergeView({ initialMain }: { initialMain: string }) {
  const [main, setMain] = useState(initialMain);
  const [alt, setAlt] = useState("");
  const [pair, setPair] = useState<Pair | null>(null);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pair && finished) return <Done mode={pair.mode} main={pair.main} alt={pair.alt} />;
  if (pair) return <ProveIt pair={pair} onBack={() => setPair(null)} onDone={() => setFinished(true)} />;

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post<MergeStart>({ step: "start", main, alt });
      if ("error" in res) setError(res.error);
      else setPair(res);
    } catch {
      setError("Couldn't start the merge right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={start} className={`${PANEL} flex flex-col gap-[14px]`}>
      <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-ink-soft">
        Main account
        <input
          value={main}
          onChange={(e) => setMain(e.target.value)}
          placeholder="the card you want to keep"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-ink-soft">
        Other account
        <input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="the one to merge in"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={INPUT}
        />
      </label>
      {error && (
        <p role="alert" className="text-[13px] leading-[1.5] text-gold-hi">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={`${BUTTON} cursor-pointer self-start`}>
        {busy ? "ONE MOMENT…" : "GET MY CODE"}
      </button>
    </form>
  );
}
