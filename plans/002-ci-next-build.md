# Plan 002: Add `pnpm build` to CI verify

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- .github/workflows/verify.yml AGENTS.md README.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (ideally after 001 so CI builds on patched Next)
- **Category**: dx
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

CI today runs lint, typecheck, unit tests, and dbtests — but not `next build`. A TypeScript error in chart legend props reached Vercel production build while CI was green. Adding `pnpm build` closes that gap. Document the same verify gate in `AGENTS.md` so agents stop treating `pnpm test` alone as sufficient.

## Current state

`.github/workflows/verify.yml`:

```yaml
- run: pnpm lint
- run: pnpm typecheck
- run: pnpm test
- run: pnpm test:db
```

No `pnpm build` step. Node is `22` with pnpm cache.

`AGENTS.md` Verify block lists only lint / typecheck / test (omits `test:db` and `build`).

`package.json` already has `"build": "next build"`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Local build | `pnpm build` | exit 0 with env present |
| Lint workflow YAML mentally | open the file | final step is `pnpm build` after tests |

## Scope

**In scope**:
- `.github/workflows/verify.yml`
- `AGENTS.md` (Verify section only)
- Optionally `README.md` Useful scripts / verify note if it currently omits `build` / `test:db` — only if those sections exist and are wrong

**Out of scope**:
- Changing Node version policy beyond documenting what CI already uses
- Adding husky/pre-commit (separate if planned elsewhere)
- Fixing app code that fails the new build step — if build fails after 001, STOP and report; do not expand scope into chart/UI fixes unless the failure is clearly a missing CI env stub

## Git workflow

- Branch: `advisor/002-ci-next-build`
- Commit message example: `Add next build to CI verify and document the gate.`
- Do NOT push unless instructed.

## Steps

### Step 1: Add build step with public env stubs

Next build needs `NEXT_PUBLIC_*` at compile time for modules that read them. Add a step **after** `pnpm test:db`:

```yaml
- name: Build
  env:
    NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder
    NEXT_PUBLIC_APP_URL: http://localhost:3000
    # DATABASE_URL is not required for next build if no module evaluates it at build time.
    # If build fails needing DATABASE_URL, set a dummy postgres URL (not a real secret):
    # DATABASE_URL: postgresql://user:pass@127.0.0.1:5432/postgres
  run: pnpm build
```

Use obviously fake placeholder values — never real project secrets. Do not print secrets in logs.

**Verify**: file contains `pnpm build` after `pnpm test:db`

### Step 2: Sync AGENTS.md Verify

Replace the Verify block with:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
```

One short note: CI runs the same sequence (`.github/workflows/verify.yml`).

**Verify**: `rg -n "pnpm build|pnpm test:db" AGENTS.md` shows both

### Step 3: Local dry-run of build with the same stubs

```bash
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
pnpm build
```

**Verify**: exit 0. If it fails needing more env, add the minimum stub to the workflow and re-try. If it fails on real TS/Next graph errors, STOP (may need 001 first, or a separate bugfix).

## Test plan

- No new unit tests. Success = green local build with CI stubs + workflow updated.

## Done criteria

- [ ] `verify.yml` runs `pnpm build` with stub public env after existing checks
- [ ] `AGENTS.md` lists lint, typecheck, test, test:db, build
- [ ] Local `pnpm build` with stubs exits 0
- [ ] No app source changes unless strictly required for stub-env build (prefer STOP)
- [ ] `plans/README.md` 002 → DONE

## STOP conditions

- Build fails for application TypeScript/Next errors even with stubs — report the error; do not silently weaken CI
- Temptation to commit real Supabase keys into the workflow
- Workflow syntax invalid YAML

## Maintenance notes

- When adding new `NEXT_PUBLIC_*` required at build time, add a matching CI stub.
- Reviewer: confirm placeholders are clearly fake and no production secrets appear in the workflow file.
