import Background from "@/components/Background";
import AppShell from "@/components/AppShell";
import { getRepoStars } from "@/lib/github/stars";
import { getScoutCount } from "@/lib/analytics";
import { SITE_URL } from "@/lib/site";

// Dynamic so the live scout count is fresh per load (the stars fetch keeps its
// own 1h cache regardless).
export const dynamic = "force-dynamic";

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "GitHoop",
      description: "Turn any GitHub profile into a player card rated out of 99.",
    },
    {
      "@type": "WebApplication",
      name: "GitHoop",
      url: SITE_URL,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      browserRequirements: "Requires JavaScript",
      description:
        "Turn any GitHub profile into an NBA 2K-inspired basketball player card rated out of 99, built from real GitHub stats.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
};

export default async function Home() {
  const [stars, scoutCount] = await Promise.all([getRepoStars(), getScoutCount()]);
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <Background />
      <AppShell stars={stars} scoutCount={scoutCount} demo={!process.env.GITHUB_TOKEN && !process.env.GITHUB_TOKENS} />
    </div>
  );
}
