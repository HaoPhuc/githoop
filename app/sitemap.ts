import type { MetadataRoute } from "next";
import { SAMPLE_LOGINS } from "@/lib/github/samples";
import { SITE_URL as BASE } from "@/lib/site";

// Home, the leaderboard + the showcase profiles (real, indexable example cards).
// Per-user pages are generated on demand, so they aren't enumerated here.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/leaderboard`, changeFrequency: "daily", priority: 0.8 },
    ...SAMPLE_LOGINS.map((login) => ({
      url: `${BASE}/${login}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
