# Plan 013: Add security headers and restrict logo/avatar URLs

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- next.config.ts lib/leagues/team-identity.ts lib/leagues/league-identity.ts lib/account/user-settings.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

`next.config.ts` has no `headers()` — no CSP, `frame-ancestors`, HSTS, or `X-Content-Type-Options`. Logo/avatar URL fields accept any `http(s)` URL (`team-identity.ts:15-17` and siblings), bypassing Supabase upload MIME/size gates. Defense-in-depth for a cookie-authenticated app before beta users.

## Current state

```ts
// next.config.ts — experimental only, no headers()
const nextConfig: NextConfig = { experimental: { ... } };
```

```ts
// team-identity.ts
if (/^https?:\/\/.+/i.test(data.logoUrl.trim())) return;
```

Same permissive pattern in `lib/leagues/league-identity.ts` and `lib/account/user-settings.ts`.

Uploads already gated in `lib/logos.ts` + storage migration — keep upload path; tighten URL mode.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build | `pnpm build` | exit 0; headers valid |
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests | `pnpm test` | exit 0 if schema tests added |

## Scope

**In scope**:
- `next.config.ts` — `headers()` with baseline hardening; start with a **report-friendly / compatible CSP** that allows Supabase auth + storage image hosts + self
- `lib/leagues/team-identity.ts`, `lib/leagues/league-identity.ts`, `lib/account/user-settings.ts` — https-only; optionally allowlist Supabase storage host from `NEXT_PUBLIC_SUPABASE_URL`
- Small zod/unit tests for URL accept/reject if schemas are pure

**Out of scope**:
- Migrating all `<img>` to `next/image`
- Full nonce-based strict CSP on day one if it breaks auth — prefer iterative CSP (`default-src 'self'` + explicit connects) and STOP if login breaks rather than shipping a broken auth CSP
- Content Security Policy that blocks inline styles required by the app without testing

## Git workflow

- Branch: `advisor/013-security-headers-logo-allowlist`
- Commit message example: `Add response security headers and https logo URL allowlisting.`
- Do NOT push unless instructed.

## Steps

### Step 1: URL validation

Require `https://` only (reject `http://`). Prefer allowlisting:

- Hostname of `NEXT_PUBLIC_SUPABASE_URL`
- Optionally same host storage path pattern

If allowlisting is too strict for existing leagues that already stored external URLs, **https-only** is the minimum ship; document allowlist as preferred.

Share one helper e.g. `lib/ui/image-url.ts` or put next to logos — DRY across the three schemas.

**Verify**: unit tests for reject http, reject javascript:, accept https supabase host

### Step 2: Headers in next.config.ts

```ts
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" }, // or CSP frame-ancestors 'none'
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // HSTS only meaningful on HTTPS production — include if safe for Vercel
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Content-Security-Policy", value: "<compatible policy>" },
    ],
  }];
}
```

CSP must allow:
- `'self'` scripts/styles as needed for Next
- Connect to Supabase URL
- `img-src` https: or allowlisted hosts (match step 1)

**Verify**: `pnpm build`; locally confirm response headers on a page (`curl -I` against `pnpm start` if feasible)

### Step 3: Manual auth smoke

If you can run the app: magic-link login flow must still work. If CSP breaks Supabase, loosen `connect-src`/`script-src` carefully — do not remove all headers.

**Verify**: document the final CSP string in the PR description

## Test plan

- URL schema unit tests
- Build succeeds

## Done criteria

- [ ] Baseline security headers present in Next config
- [ ] Logo/avatar URL mode rejects `http://` at minimum
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` exit 0
- [ ] `plans/README.md` 013 → DONE

## STOP conditions

- CSP cannot be made compatible with Supabase auth without days of tuning — ship other headers + https URL rule, leave CSP as a follow-up note in README status
- Existing stored http logos must keep rendering — allow read of legacy URLs in UI but reject new saves of http

## Maintenance notes

- Reviewer: watch for broken avatar loads after allowlist
- Tighten CSP over time; do not block beta on perfect CSP
