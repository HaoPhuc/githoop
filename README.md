# GitHoop

Your GitHub, drafted onto the court. Turn GitHub profiles into basketball player cards inspired by NBA 2K, rated out of 99 from real contributions, stars, and collaboration.

Adapted from [GitFut / gitfutbol](https://github.com/Younesfdj/gitfutbol), with basketball positions, attributes, awards, courts, and card artwork.

## Run locally

Requires Node.js 20.9 or later and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Bundled sample profiles—including `torvalds`, `ThePrimeagen`, and `t3dotgg`—work without credentials. Samples are snapshots, not live GitHub data. Other profiles require a GitHub token.

Copy `.env.example` to `.env.local` to configure:

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Server-side token for live GitHub GraphQL scouting. No write permissions needed. |
| `GITHUB_TOKENS` | Optional comma-separated token pool. |
| `REDIS_URL` | Optional shared cache, scouting counter, registry, leaderboard, and national roster persistence. Required for merging accounts and seeding the leaderboard. Without Redis, sample-backed views remain available. |
| `CRON_SECRET` | Optional. Unlocks `/api/cron/seed`, which fills the leaderboard from GitHub's follower ranking. The route stays closed without it. |
| `NEXT_PUBLIC_SITE_URL` | Your app's origin for sharing, embeds, and metadata. Defaults to `http://localhost:3000`; set before production builds. |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional error monitoring for your own project. |
| `NEXT_PUBLIC_UMAMI_SRC`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Optional analytics; both must be configured. |

## Features

- Player scouting, card reveals, scouting reports, country selection, and PNG downloads.
- A Year Ring on every card: the last 52 weeks of contributions wrapped around the ball.
- Merging one person's GitHub accounts into one card at `/merge`, proved by a short code in both bios.
- Share links, social preview images, and live card embeds at `/<username>.png`.
- Head-to-head duels at `/<username>/vs/<opponent>` with basketball scoring and overtime.
- Career progression, potential, fictional player valuations, playstyle badges, and earned awards.
- A leaderboard with country and position filters, optionally seeded from GitHub's most followed developers.
- National rosters with five starters and up to fifteen players, plus GitHub organization teams.
- Responsive layouts, keyboard controls, and reduced-motion support.

## Basketball ratings

| Attribute | GitHub signal |
| --- | --- |
| **ATH — Athleticism** | Recent contribution activity |
| **SHO — Shooting** | Repository stars and standout projects |
| **PAS — Passing** | Pull requests and followers |
| **HND — Handles** | Programming language diversity |
| **DEF — Defense** | Reviews and issues |
| **REB — Rebounding** | Lifetime contributions and active years |

The scout assigns **PG, SG, SF, PF, or C** from a profile's attribute shape. The inherited logarithmic model caps base overall at 88; sustained history and influence can raise it to 99. Tiers are Bronze, Silver, Gold, Hot Streak, All-Star, and Hall of Fame.

Awards are earned from GitHub activity: MVP for standout seasons, Clutch Performer for strong June development sprints, Scoring Champion for elite shooting, and Championship for sustained elite seasons. These are developer achievements, not claims about real NBA results. Country selection never awards a trophy. Player valuations are fictional and expressed in dollars.

Around your photo, the **Year Ring** wraps your last 52 weeks around the ball: one ray a week, seven cells deep. Every extra cell takes twice the contributions, and 64+ in a week fills the ray, so no two cards look the same. Team cards have no single calendar, so they get an even ring sized by tier.

## Merge accounts

Got more than one GitHub account? `/merge` combines up to four into one card. There are no logins, so ownership is proved with a short code added to the bio of both accounts, and the same proof splits a merge. A merged card adds up the accounts' activity and reach under the main account. The other accounts leave the leaderboard, and their pages, image links, and duels answer with the main card. Merging needs Redis.

## Seed the leaderboard

Without seeding, the leaderboard only holds people someone looked up. `/api/cron/seed` scouts the next players down GitHub's follower ranking for about four minutes per run, skipping players already on the board. It needs `REDIS_URL`, a GitHub token, and `CRON_SECRET`.

`vercel.json` runs it daily on Vercel. Anywhere else, call it from your own scheduler:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://your-host.example/api/cron/seed
```

## Embed a card

Replace `YOUR_SITE` with your configured deployment host:

```md
[![My GitHoop card](https://YOUR_SITE/YOUR_USERNAME.png)](https://YOUR_SITE/YOUR_USERNAME)
```

Add `?country=US` to override the flag. JSON is available at `/api/card/<username>`.

## Checks and deployment

```sh
npm test
npm run lint
npm run build
npm start
```

Card art lives in `public/cards`. To change a tier's artwork, edit `scripts/bake-card-art.ts` and run `npx tsx scripts/bake-card-art.ts`.

Built with Next.js App Router, React, TypeScript, Tailwind, and optional Redis. The Dockerfile builds a standalone Node server. Configure your own environment variables and public URL when deploying.

Public settings are embedded at build time. For Docker, pass your real origin when building, then supply server credentials when starting the container:

```sh
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://your-host.example -t githoop .
docker run --env-file .env.local -p 3000:3000 githoop
```

The Dockerfile also accepts build arguments for the optional public Sentry and Umami settings. GitHub tokens and Redis credentials must remain runtime environment variables, never build arguments.

## License and attribution

[MIT](LICENSE), copyright 2026 Phuc Huynh and Younesfdj (original GitFut code). The upstream copyright notice is preserved. GitHoop is independent and not affiliated with the NBA, NBA 2K, 2K, or GitHub. New basketball graphics are original SVG artwork; avatars and language marks belong to their respective owners.
