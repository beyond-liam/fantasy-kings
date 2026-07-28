# Plan 016: Sync PROJECT_SPEC status tables with shipped code

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- docs/PROJECT_SPEC.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

`docs/PROJECT_SPEC.md` §1b still lists SOS, playoff chance, HoF, roast, Team Stats as planned while §12 marks them shipped. KPI strip is described as shipped in §6 but §12 still groups it with open charts 5–6. §2 still says typed mocks are for unwired matchups/trades/draft. Agents using §1b as source of truth will rebuild shipped work or miss remaining items.

## Current state

- Last updated header: `2026-07-25`
- §12 line ~656: open “charts 5–6 + KPI strip” despite KPI cards live in `components/team/team-stats-metric-cards.tsx`
- §2 sequencing (~103): mocks for matchups/trades/activity/draft — those features are shipped
- Remaining true opens: advanced player filtering; matchup insights / would-have-won; charts 5–6 concentration; season rewind

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Grep consistency | `rg -n "KPI strip|planned|Team Stats" docs/PROJECT_SPEC.md` | no contradictory “planned” for shipped items |

## Scope

**In scope**: `docs/PROJECT_SPEC.md` only

**Out of scope**: code changes; implementing remaining features

## Git workflow

- Branch: `advisor/016-sync-project-spec`
- Commit message example: `Align PROJECT_SPEC status tables with shipped Team Stats and engagement.`
- Do NOT push unless instructed.

## Steps

### Step 1: Refresh §1b

Move shipped engagement rows into the shipped table; leave only unfinished near-term/deferred items in planned lists. Bump “Last updated” to the day you edit.

### Step 2: Fix §12 checklist

- Mark KPI strip done
- Leave concentration (+ optional margins chart) open
- Keep advanced filters / insights / would-have-won / season rewind open

### Step 3: Fix stale §2 / schema notes

Rewrite mock sequencing for “UI on real data”; mark HoF schema/UI as shipped where accurate.

### Step 4: Changelog

Add a short docs-only changelog bullet.

**Verify**: read §1b vs §12 — no item both “planned” and “[x] shipped” incorrectly

## Test plan

Docs only — no automated tests.

## Done criteria

- [ ] §1b and §12 agree on Team Stats KPI + charts 1–4 shipped
- [ ] No stale “mocks for unwired matchups/trades/draft” guidance
- [ ] Last updated bumped
- [ ] `plans/README.md` 016 → DONE

## STOP conditions

- Uncertainty whether a feature is half-shipped — check the code path once; if still unclear, leave a `TODO(verify)` note rather than guessing

## Maintenance notes

- Future feature PRs must update §1b/§12/changelog together (AGENTS.md already says so)
