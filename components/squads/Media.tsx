/* eslint-disable @next/next/no-img-element -- flags are tiny static PNGs and
   avatars come from GitHub's own CDN at the size asked for; next/image would only
   add an optimizer hop (and a remotePatterns entry) for both. */

// The two images on the squad pages. No hooks or handlers, so server and
// client components can both render them.

export function Flag({ code, className = "" }: { code: string; className?: string }) {
  return (
    <img
      src={`/badges/flags/${code}.png`}
      alt=""
      width={100}
      height={60}
      loading="lazy"
      className={`flex-none object-cover shadow-[0_0_0_1px_rgba(255,255,255,.07)] ${className}`}
    />
  );
}

// GitHub avatars are stored at 480px; a chip needs a fraction of that (asked at
// 2x for sharp screens).
function sized(url: string, px: number): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "avatars.githubusercontent.com") return url;
    u.searchParams.set("s", String(px));
    return u.toString();
  } catch {
    return url;
  }
}

export function Avatar({ src, px, className = "" }: { src: string; px: number; className?: string }) {
  return (
    <span className={`block flex-none overflow-hidden rounded-full bg-surface-2 ${className}`}>
      {src && (
        <img src={sized(src, px * 2)} alt="" width={px} height={px} loading="lazy" className="h-full w-full object-cover" />
      )}
    </span>
  );
}
