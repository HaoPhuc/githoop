# Security policy

Report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/HaoPhuc/githoop/security/advisories/new), if enabled. Do not include credentials or exploit details in public issues.

Include the affected route or file, reproduction steps, and expected impact. This policy covers the GitHoop source and its API routes. Report third-party package vulnerabilities to their maintainers as appropriate.

Keep GitHub tokens and Redis credentials in server-side environment variables. Never prefix them with `NEXT_PUBLIC_` or commit `.env.local`.
