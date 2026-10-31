// Panel chrome shared by the two squad pages, in the scout report's style.

export function Section({
  title,
  accent = "#f28a43",
  aside,
  children,
}: {
  title: string;
  accent?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-[16px] max-[420px]:px-[12px]">
      <div className="mb-[12px] flex items-center gap-[9px]">
        <span className="h-[2px] w-[16px] flex-none rounded-full" style={{ background: accent }} />
        <h2 className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint">{title}</h2>
        {aside && <span className="ml-auto text-[12px] tabular-nums text-ink-mute">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export function Tile({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-[16px] py-[14px] max-[620px]:px-[11px] max-[620px]:py-[11px]">
      <div className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint max-[620px]:tracking-[.12em]">
        {label}
      </div>
      <div
        className="font-display mt-[6px] text-[clamp(26px,7vw,40px)] leading-none tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </div>
      <div className="mt-[6px] text-[12.5px] leading-[1.35] text-ink-soft max-[620px]:text-[11.5px]">{note}</div>
    </div>
  );
}

// Without Redis the registry lives in this server's memory (lib/registry), so
// say why the squads look thin rather than let them pass for the real thing.
export function DemoNote() {
  return (
    <p className="rounded-xl border border-gold/[0.22] bg-gold/[0.05] px-[14px] py-[10px] text-[12.5px] leading-[1.5] text-ink-soft">
      <span className="font-semibold text-gold">Demo registry.</span> No shared store is set up here, so squads
      only hold the sample cards and players scouted on this server since it started.
    </p>
  );
}
