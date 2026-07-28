# Plan 020: Beta ops runbook for cron + score pipeline

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- docs/ lib/cron/ app/api/cron/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (complements 003–005)
- **Category**: direction
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

First real game week fails silently if `CRON_SECRET` is unset (`lib/cron/auth.ts` returns 503) or cron-job.org is misconfigured. Spec depends on external cron (`docs/PROJECT_SPEC.md`). This is an **ops/docs + light smoke** plan, not a feature build.

## Current state

- Cron routes under `app/api/cron/*` gated by `assertCronAuthorized`
- Score sync: `/api/cron/sync-scores`
- Related: process-waivers, process-trades, start-drafts, etc.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Docs only | n/a | runbook exists |

## Scope

**In scope**:
- New doc e.g. `docs/ops/cron-runbook.md` (or section in PROJECT_SPEC) covering: required Vercel env vars (names only, no values), cron-job.org schedule suggestions for game days, how to manually hit sync-scores with Bearer auth, expected JSON shape, what 401/503 mean, how to force nflverse (`nflverse=1`)
- Optional: tiny script or documented `curl` examples using env var references like `$CRON_SECRET` — never hardcode secrets
- Checklist for pre-season: CRON_SECRET set, each cron URL returns 200 with auth

**Out of scope**:
- Building a full monitoring SaaS integration
- Changing cron auth scheme
- Implementing plans 003–005 (reference them as prerequisites for confidence)

## Git workflow

- Branch: `advisor/020-beta-ops-cron-runbook`
- Commit message example: `Add cron and score-sync ops runbook for beta game weeks.`
- Do NOT push unless instructed.

## Steps

### Step 1: Inventory cron routes

`ls app/api/cron` and document each path + purpose from the route file header comments.

### Step 2: Write runbook

Include failure modes from audits: finalize skipped on upserted 0 (fixed in 004), nflverse empty board (005), missing CRON_SECRET → 503.

### Step 3: Link from PROJECT_SPEC / README

One line pointer to the runbook.

**Verify**: doc renders; no secret values committed (`rg` for long tokens in the new file → none)

## Test plan

Docs only. Optionally dry-run curl against local `pnpm dev` with a test secret — do not commit the secret.

## Done criteria

- [ ] Runbook lists all cron routes, env var **names**, auth header form, and game-day checklist
- [ ] Linked from README or PROJECT_SPEC
- [ ] No secrets in git
- [ ] `plans/README.md` 020 → DONE

## STOP conditions

- Operator asks for production secret rotation in-repo — do that out of band
- Discover a cron route without auth — STOP and escalate as security before documenting a public URL

## Maintenance notes

- Update runbook when adding cron routes
- Pair with 003–005 before kickoff
