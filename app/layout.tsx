import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import BallCursor from "@/components/BallCursor";
import { SITE_URL } from "@/lib/site";

// Umami analytics, loaded only when this deployment has its own instance set up.
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC;
const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

// Bundled display font keeps builds independent of Google Fonts.
const display = localFont({
  src: "./fonts/BebasNeue-Regular.ttf",
  variable: "--font-bebas",
  display: "swap",
});

// Player card fonts (DINPro suite) inherited from the original generator — used by the
// player card overlays. (Champions-*.otf/ttf are also bundled in ./fonts for
// future use but not wired here.)
const dinCond = localFont({ src: "./fonts/DINPro-Cond.otf", variable: "--font-din-cond", display: "swap" });
const dinBold = localFont({ src: "./fonts/DINPro-CondBold.otf", variable: "--font-din-bold", display: "swap" });
const dinMedium = localFont({ src: "./fonts/DINPro-CondMedium.otf", variable: "--font-din-medium", display: "swap" });

const TITLE = "GitHoop — your GitHub, rated out of 99";
const DESCRIPTION =
  "Turn your GitHub profile into a basketball player card inspired by NBA 2K, rated out of 99 from real commits, stars and contributions. Get scouted and share your card.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "GitHub profile card",
    "rate my GitHub",
    "GitHub stats",
    "developer trading card",
    "basketball player card",
    "GitHub rating",
    "NBA 2K inspired",
    "GitHoop",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "GitHoop",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0603",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${dinCond.variable} ${dinBold.variable} ${dinMedium.variable} antialiased`}
      style={{ "--font-inter": "Arial, Helvetica, sans-serif", "--font-jetbrains": "Consolas, monospace" } as React.CSSProperties}
    >
      <body>
        <BallCursor />
        {children}
        {UMAMI_SRC && UMAMI_WEBSITE_ID && <Script defer src={UMAMI_SRC} data-website-id={UMAMI_WEBSITE_ID} />}
      </body>
    </html>
  );
}
