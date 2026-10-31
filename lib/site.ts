// The deployment's public address: the single source for share links, metadata,
// the sitemap and every place the domain is printed (card signature, OG images).
// NEXT_PUBLIC_SITE_URL overrides it (e.g. a staging deployment); it's read at
// build time, like every NEXT_PUBLIC_ value.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

// The configured host, for printing on cards.
export const SITE_HOST = new URL(SITE_URL).host;
