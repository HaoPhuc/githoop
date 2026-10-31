# Contributing to GitHoop

Clone [HaoPhuc/githoop](https://github.com/HaoPhuc/githoop), install with `npm ci`, and run `npm run dev`. Node.js 20.9+ is required. Bundled sample profiles work without credentials; see [README.md](README.md) and `.env.example` for live scouting and optional Redis.

Before opening a pull request, run:

```sh
npm test
npm run lint
npm run build
```

Match the existing TypeScript and component conventions. Add meaningful tests when changing scoring, roster selection, GitHub parsing, or other behavior. Include screenshots for visual changes, and keep secrets out of commits.

Report bugs through [GitHub issues](https://github.com/HaoPhuc/githoop/issues). For vulnerabilities, see [SECURITY.md](SECURITY.md). Contributions are licensed under the project's [MIT license](LICENSE).
