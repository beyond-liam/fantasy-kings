# Plan 017: Complete .env.example and align verify docs

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- .env.example README.md AGENTS.md drizzle.config.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/002-ci-next-build.md` for AGENTS verify list (or include the same verify list here if 002 not done)
- **Category**: dx
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

`.env.example` omits `DIRECT_URL` while `drizzle.config.ts` requires it for migrations. README documents Direct URL but the example file new contributors copy does not. README Node “20+” vs CI Node 22 mismatch. Without husky, local gates are optional — add a **light** optional note or husky only if low friction; prefer docs accuracy first over mandatory hooks if hooks fight agent workflows.

## Current state

- `.env.example` has `DATABASE_URL=` but no `DIRECT_URL=`
- `drizzle.config.ts` uses `process.env.DIRECT_URL!`
- CI: Node 22; README may say 20+
- No `.husky/` in repo (pre-commit optional)

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Grep env | `rg -n "DIRECT_URL|DATABASE_URL" .env.example README.md drizzle.config.ts` | DIRECT_URL documented in example |

## Scope

**In scope**:
- `.env.example` — add commented `DIRECT_URL=` with pooler-vs-direct note matching README
- `README.md` — Node 22 (or “20+ locally, CI uses 22”); mention `pnpm test:db` and `pnpm build` in useful scripts if missing
- `AGENTS.md` — only if 002 did not already sync Verify
- **Optional**: husky + lint-staged for eslint on staged files — only if you can add it without committing secrets and without slowing every commit by >15s. If husky setup is painful, skip and note in plan status as deferred.

**Out of scope**:
- Changing drizzle config behavior
- Real secrets

## Git workflow

- Branch: `advisor/017-dx-env-agents-verify`
- Commit message example: `Document DIRECT_URL and align local verify docs with CI.`
- Do NOT push unless instructed.

## Steps

### Step 1: .env.example

```
# Direct (non-pooled) URL for Drizzle Kit migrations — see README
DIRECT_URL=
```

Keep empty. Never paste real URLs.

### Step 2: README / AGENTS

Align Node and scripts with `.github/workflows/verify.yml`.

### Step 3 (optional): husky

If adding: lint-staged eslint on `*.{ts,tsx}` only — not full test:db.

**Verify**: files updated; no secrets

## Test plan

Docs/config examples only.

## Done criteria

- [ ] `.env.example` documents `DIRECT_URL`
- [ ] README/AGENTS match CI verify commands and Node story
- [ ] `plans/README.md` 017 → DONE

## STOP conditions

- Temptation to commit a filled `.env` — never
- Husky breaks pnpm on this machine — skip husky

## Maintenance notes

- When adding env vars, update `.env.example` in the same PR
