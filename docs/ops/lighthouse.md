# Lighthouse (synthetic performance)

Measure Core Web Vitals against a running Fantasy Kings instance. Free-tier friendly: uses `pnpm dlx lighthouse` (no permanent dependency).

## Targets

| Metric | Good |
|--------|------|
| LCP | ≤ 2.5s |
| INP | ≤ 200ms |
| CLS | ≤ 0.1 |
| TTFB (server) | prefer ≤ 600ms on warm local |

## Smoke (no auth)

```bash
pnpm dev   # separate terminal
pnpm lighthouse:smoke
```

Hits `/login` and `/rankings`. Reports land in `.lighthouse/`.

## Authenticated league routes

1. Log in at `http://localhost:3000` in Chrome.
2. DevTools → **Application** → **Cookies** → copy cookie header values for the app origin (typically `sb-<project>-auth-token` and related).
3. Run:

```bash
LIGHTHOUSE_BASE_URL=http://localhost:3000 \
LIGHTHOUSE_COOKIE='sb-xxxx-auth-token=...' \
LIGHTHOUSE_LEAGUE_ID='yourLeaguePublicId' \
pnpm lighthouse:league
```

Routes audited:

- `/league/{id}` (overview — exercises Suspense tab panels)
- `/league/{id}?tab=standings`
- `/league/{id}/players`
- `/league/{id}/team`
- `/league/{id}/scores`

## Output

- HTML reports: `.lighthouse/*.report.html`
- JSON summary: `.lighthouse/league-summary.json` or `smoke-summary.json`

Compare LCP/TTFB before vs after perf changes on the same machine/network.
