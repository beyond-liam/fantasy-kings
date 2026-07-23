# Plan 007: Make the verification baseline green and complete

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e1e7f1e..HEAD -- package.json eslint.config.mjs AGENTS.md README.md hooks/ components/ lib/actions/leagues.ts lib/actions/league-settings.ts lib/leagues/utils.ts lib/leagues/waivers/calendar.ts lib/scores/sync-sleeper-scores.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED (the setState-in-effect fixes touch client behavior)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `e1e7f1e`, 2026-07-23

## Why this matters

The repo's documented verify gate (`AGENTS.md`: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`) is currently red and partial: `pnpm lint` fails with 23 errors, and `pnpm test` runs an explicit list of 15 test files while 4 more passing test files exist and never run (`lib/leagues/ir-lock.test.ts`, `lib/leagues/roster-capacity.test.ts`, `lib/leagues/draft/board.test.ts`, `lib/mock-draft/bot.test.ts` — 18 extra passing tests). There is no CI and no `typecheck` script. Every other plan in this directory relies on these gates; until they are green and complete, "tests pass" means less than it should.

## Current state

- `package.json:10` — `"test"` is a hardcoded list of 15 `tsx --test` file paths. Verified 2026-07-23: `pnpm exec tsx --test 'lib/**/*.test.ts'` runs **39 suites / 93 tests, all passing** (the current script runs only 75).
- `package.json` has no `typecheck` script. `AGENTS.md` ("Verify" section) says to prefer `pnpm typecheck` once available.
- `pnpm lint` → `✖ 53 problems (23 errors, 30 warnings)`. The 23 errors break down as:
  - **5 × `prefer-const`** (all auto-fixable with `eslint --fix`):
    - `lib/actions/league-settings.ts:183` (`slug`)
    - `lib/actions/leagues.ts:69` (`slug`)
    - `lib/leagues/utils.ts:32` (`candidate`)
    - `lib/leagues/waivers/calendar.ts:34` (`daysSinceWed`)
    - `lib/scores/sync-sleeper-scores.ts:190` (`week`)
  - **17 × `react-hooks/set-state-in-effect`** ("Calling setState synchronously within an effect can trigger cascading renders") at:
    - `components/leagues/create-success-invite.tsx:35`
    - `components/leagues/create-wizard/create-wizard.tsx:56`
    - `components/leagues/draft/draft-room.tsx:164`
    - `components/leagues/game-centre/matchup-header.tsx:27`
    - `components/leagues/invite-link-card.tsx:38`
    - `components/leagues/matchups/week-matchups-list.tsx:53`
    - `components/leagues/scoring/scoring-rule-dialog.tsx:153`
    - `components/rankings/players-data-table.tsx:107`
    - `components/team/claim-player-dialog.tsx:72`
    - `components/team/edit-claim-dialog.tsx:58`
    - `components/team/roster-sections.tsx:74`
    - `components/team/team-waivers-section.tsx:186`
    - `components/team/waiver-results-dialog.tsx:36`
    - `components/trades/trade-list.tsx:99` and `:103` (two errors in one file)
    - `components/ui/carousel.tsx:99` (vendored shadcn primitive)
    - `hooks/use-mobile.ts:14`
  - **1 × react-hooks dependency-list error**: `components/leagues/draft/draft-queue-provider.tsx:37` — "Expected the dependency list to be an array of simple expressions".
- The 30 warnings are all `@typescript-eslint/no-unused-vars` (unused imports/variables) — cleaning them is in scope but optional; errors are the gate.
- No `.github/workflows/` directory exists. `vercel.json` only defines cron schedules.
- `pnpm exec tsc --noEmit` currently exits 0 (verified) — don't break it.
- Node is v22, package manager is pnpm (lockfile: `pnpm-lock.yaml`).
- Repo conventions: TypeScript strict; commit messages are single imperative sentences ending with a period, e.g. `Speed up My Team and harden league domain boundaries.`

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install --frozen-lockfile` | exit 0              |
| Typecheck | `pnpm exec tsc --noEmit`         | exit 0              |
| Tests     | `pnpm test`                      | 93 tests pass       |
| Lint      | `pnpm lint`                      | exit 0, 0 errors    |
| Auto-fix  | `pnpm lint --fix`                | fixes prefer-const  |

## Scope

**In scope** (the only files you should modify):
- `package.json` (scripts only)
- `AGENTS.md`, `README.md` (verify-instructions wording)
- `.github/workflows/verify.yml` (create)
- The 5 `prefer-const` files listed above
- The 17 files with `react-hooks` errors listed above
- Files with `no-unused-vars` warnings (optional cleanup, only if trivial)

**Out of scope** (do NOT touch, even though they look related):
- `eslint.config.mjs` — do not weaken or disable rules globally. Per-line disables with a justification comment are allowed where specified below; config-level rule changes are not.
- Any server action / query / domain logic beyond the exact `prefer-const` lines.
- `vercel.json`, deployment config.

## Git workflow

- Branch: `advisor/007-verification-baseline`
- Commit per step; message style: single imperative sentence with a period (match `git log`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add typecheck script and switch tests to a glob

In `package.json`:
1. Add `"typecheck": "tsc --noEmit"` to `scripts`.
2. Replace the entire `"test"` value with: `tsx --test 'lib/**/*.test.ts'`

**Verify**: `pnpm typecheck` → exit 0. `pnpm test` → output ends with `# tests 93` / `# pass 93` / `# fail 0`. (If new test files were added since this plan, pass count may be higher — fail count must be 0.)

### Step 2: Auto-fix the prefer-const errors

Run `pnpm lint --fix`. This should fix exactly the 5 `prefer-const` errors. Review the diff — only `let` → `const` changes on the 5 lines listed in Current state are expected.

**Verify**: `pnpm lint 2>&1 | grep -c "prefer-const"` → `0`. `git diff --stat` shows only the 5 files.

### Step 3: Fix the react-hooks errors

For each of the 18 error sites, apply this decision tree in order:

1. **State derived from props/state** (the effect computes something from values already in render scope and stores it in state): delete the state + effect and compute during render. See React docs "You Might Not Need an Effect".
2. **Reset-on-open / reset-on-prop-change dialogs** (`useEffect(() => { setX(initial) }, [open])` or similar — likely shape of `claim-player-dialog.tsx`, `edit-claim-dialog.tsx`, `scoring-rule-dialog.tsx`, `waiver-results-dialog.tsx`, `trade-list.tsx`): prefer passing a `key` to the stateful subtree so it remounts with fresh state, or move the reset into the event handler that opens the dialog.
3. **Subscribing to an external/client-only value** (`hooks/use-mobile.ts` matchMedia): rewrite with `useSyncExternalStore` (subscribe to `matchMedia` change events; `getSnapshot` returns the boolean; `getServerSnapshot` returns `false`).
4. **Anything genuinely needing a synchronous post-render setState** where a refactor would change behavior you cannot verify: keep the code and add
   `// eslint-disable-next-line react-hooks/set-state-in-effect -- <one-line reason>`
   directly above the line. `components/ui/carousel.tsx` is a vendored shadcn primitive — use this option there; do not restructure vendored ui primitives.

For `components/leagues/draft/draft-queue-provider.tsx:37` (dependency-list error): extract the complex expression in the dependency array into a `const` above the hook so each dependency is a simple identifier/member expression.

Work file by file; after each file run `pnpm lint <file>` and `pnpm typecheck`. Do not change what any component renders — these are mechanical restructures.

**Verify**: `pnpm lint` → exit 0, `0 errors` (warnings may remain). `pnpm typecheck` → exit 0. `pnpm test` → 0 fail.

### Step 4: (Optional) clear trivial unused-vars warnings

Delete unused imports/variables flagged by `@typescript-eslint/no-unused-vars` only where removal is obviously safe (unused import specifiers). Skip anything ambiguous — e.g. `lib/cron/process-trades.ts:21` `_now` is an intentionally unused parameter; leave it.

**Verify**: `pnpm lint` still exits 0; `pnpm typecheck` exit 0.

### Step 5: Add the CI workflow

Create `.github/workflows/verify.yml`:

```yaml
name: verify
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```

Note: `pnpm/action-setup@v4` reads the pnpm version from the `packageManager` field if present; if `pnpm install --frozen-lockfile` fails in CI because no version is pinned, add a `packageManager` field to `package.json` matching the local `pnpm --version`.

**Verify**: `pnpm exec node -e "require('js-yaml')"` is NOT available — instead validate by eye and run `git status` to confirm only the new file. (CI itself verifies on next push.)

### Step 6: Update docs

- `AGENTS.md` "Verify" section: replace the three commands with `pnpm lint` / `pnpm typecheck` / `pnpm test`, and delete the sentence "After broader test scaffold lands, prefer `pnpm typecheck` / `pnpm test` as documented in the spec checklist."
- `README.md`: if it says tests will "expand with Vitest later" or lists the explicit test-file approach, update to say tests run via node:test through `tsx --test 'lib/**/*.test.ts'`.

**Verify**: `grep -n "Vitest" README.md` → no matches; `grep -n "typecheck" AGENTS.md` → shows the new command.

## Test plan

No new tests. The deliverable is that the existing 93 tests all run under `pnpm test` and every gate is green.

## Done criteria

- [ ] `pnpm lint` exits 0 with 0 errors
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test` exits 0 with `# fail 0` and at least 93 tests
- [ ] `.github/workflows/verify.yml` exists and runs lint → typecheck → test
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Fixing a `set-state-in-effect` site requires understanding domain behavior you cannot verify from the code (e.g. draft-room clock sync in `draft-room.tsx:164`) AND the disable-with-comment fallback feels wrong — report the site instead of guessing at a refactor.
- `pnpm test` with the glob picks up a file that fails (a test that was passing in isolation starts failing under the shared process).
- `pnpm lint --fix` changes anything other than `let` → `const` on the 5 listed lines.
- Any component's rendered output would change under your refactor.

## Maintenance notes

- Once CI is green, plans 008–011 should keep it green; reviewers should reject PRs that re-add eslint-disable comments without justification text.
- The test glob means any new `lib/**/*.test.ts` file runs automatically — no more script edits. Plan 009 adds a separate `test:db` script for DB-backed tests; keep the two scripts distinct.
- Deferred: the 30 unused-vars warnings that aren't trivially removable, and any deeper refactor of `draft-room.tsx` effects.
