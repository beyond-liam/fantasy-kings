# Plan 008: Authenticate player profile and stop leaking league scoring

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/actions/player-profile.ts lib/queries/player-profile.ts lib/actions/account.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

`loadPlayerProfile` is a Server Action with **no** session check. When `leagueSlug` is passed, `getPlayerProfile` resolves that league's custom `scoringPreset` / `scoringRules` **before** membership is checked (`lib/queries/player-profile.ts:554-567`). Anyone who can invoke the action with a known slug learns private scoring. The action also returns raw `error.message` to clients; `lib/actions/account.ts` forwards Supabase `error.message` similarly.

## Current state

```ts
// lib/actions/player-profile.ts
export async function loadPlayerProfile(input: {...}) {
  // no requireSessionUser
  try {
    const profile = await getPlayerProfile(...);
    ...
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "..." };
  }
}
```

Ownership/activity are membership-gated later; scoring is not.

Auth exemplar: other actions use `requireSessionUser` / `getSessionUser` from `@/lib/auth/session` and membership helpers — match `lib/actions/roster.ts` or `lib/actions/messages.ts` patterns.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | exit 0 |

## Scope

**In scope**:
- `lib/actions/player-profile.ts` — require session; map errors to stable strings
- `lib/queries/player-profile.ts` — only apply league scoring after membership (or after confirming user is a member); non-members get default scoring or a generic not-found/forbidden without custom rules
- `lib/actions/account.ts` — map known email-change failures to stable user strings; log provider detail server-side only (console.error is fine)

**Out of scope**:
- Rewriting the entire player profile UI
- Zod for all actions (plan 014)
- Cron error message hardening beyond what's already gated by CRON_SECRET

## Git workflow

- Branch: `advisor/008-auth-player-profile`
- Commit message example: `Require auth for player profiles and stop leaking league scoring.`
- Do NOT push unless instructed.

## Steps

### Step 1: Gate the Server Action

At the top of `loadPlayerProfile`:

```ts
const user = await getSessionUser(); // or requireSessionUser() if that helper throws/redirects
if (!user) {
  return { success: false as const, error: "Sign in to view player profiles." };
}
```

Use the same session helper other actions use. Do not return stack traces.

**Verify**: `pnpm typecheck`

### Step 2: Membership before league scoring

In `getPlayerProfile`, when `input.leagueSlug` is set:

1. Resolve league
2. If no session user → do not load custom scoring (action already blocks, but belt-and-suspenders)
3. Check `getLeagueMembership(league.id, user.id)` **before** `resolveScoringRuleDefinitions` from that season
4. If not a member → omit league scoring / ownership / activity; use default full_ppr (or return null profile league context). Do **not** return custom rules

Keep public-ish player bio fields available to signed-in users without a league slug.

**Verify**: reasoning covered by a unit test with mocked DB if feasible; otherwise a focused query test. Prefer testing a small extracted `resolveProfileScoring({ membership, seasonRow })`.

### Step 3: Stable client errors

In `player-profile.ts` action catch:

```ts
console.error(error);
return { success: false as const, error: "Could not load player profile." };
```

In `account.ts` email update: map to `"Could not update email."` (and fieldError the same) unless you already have a safe allowlist of Supabase codes — never forward raw provider strings.

**Verify**: `rg -n "error\\.message" lib/actions/player-profile.ts lib/actions/account.ts` shows no client returns of raw messages (logging OK)

## Test plan

- Helper: member → custom scoring; non-member → default / no custom rules
- Action: unauthenticated → failure without calling deep query if possible

## Done criteria

- [ ] Unauthenticated `loadPlayerProfile` fails closed
- [ ] Custom league scoring only after membership
- [ ] No raw provider/Error messages returned from these two actions
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` exit 0
- [ ] `plans/README.md` 008 → DONE

## STOP conditions

- Player profile is intentionally public without auth for product reasons — STOP and confirm with operator (audit assumes private friend leagues)
- Membership helper semantics differ for commissioners/spectators — preserve intended roles without leaking scoring to outsiders

## Maintenance notes

- Reviewer: confirm UI still works for members viewing profiles from league pages
- Follow-up: audit other actions that return `error.message` (grep) — only fix the two files in scope unless trivial identical one-liners
