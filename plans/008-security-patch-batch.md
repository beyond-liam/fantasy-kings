# Plan 008: Patch Next.js advisories, gate autopick behind the clock, and validate scoring-rule writes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e1e7f1e..HEAD -- package.json lib/actions/draft.ts lib/actions/league-settings.ts lib/leagues/scoring/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (007 recommended first so gates are green)
- **Category**: security
- **Planned at**: commit `e1e7f1e`, 2026-07-23

## Why this matters

Three independent, small security fixes:

1. `pnpm audit --prod` reports **high** advisories against `next@16.2.10`, including GHSA-m99w-x7hq-7vfj (Denial of Service via Server Actions, patched in `>=16.2.11`). This app's entire mutation surface is Server Actions (`lib/actions/*`), so the DoS advisory is directly reachable. Additionally the `shadcn` CLI sits in production `dependencies` and drags a high `fast-uri` advisory (via `shadcn > @dotenvx/dotenvx > conf > ajv > fast-uri`) into the production dependency graph.
2. Any league member can force another manager's draft pick early: `autoDraftCurrentPick` verifies league membership but never checks whether the pick clock has expired.
3. `updateScoringRules` writes a caller-supplied `ScoringRuleDefinition[]` straight into `league_seasons.settings` JSON with no runtime validation — a malformed payload corrupts the scoring engine used by standings, matchups, and player points.

## Current state

### (a) Dependencies

- `package.json` pins `"next": "16.2.10"` and `"eslint-config-next": "16.2.10"` (devDependencies); `"shadcn": "^4.13.0"` is in **dependencies** (production).
- `pnpm audit --prod` (verified 2026-07-23) reports high advisories: `next >=16.0.0 <16.2.11` (GHSA-m99w Server Action DoS, GHSA-6gpp proxy bypass, plus SSRF advisories not reachable on Vercel), `sharp <0.35.0` via `next>sharp` (GHSA-f88m), `fast-uri <=3.1.3` via the `shadcn` chain (GHSA-v2hh).
- **As of planning time, `16.2.11` is not yet published** — `pnpm view next dist-tags` shows `latest: 16.2.10`. Step 1 starts with an availability check.

### (b) Autopick clock

`lib/actions/draft.ts` — `autoDraftCurrentPick(slug)` (starts line 296):

```ts
// lib/actions/draft.ts:304-321 (abridged)
const { season, isCommissioner, seasonTeams, userTeam } = context;
if (!userTeam && !isCommissioner) {
  return { success: false, error: "Only league members can trigger autopick." };
}

const draft = await getDraftBySeasonId(season.id);
if (!draft || draft.status !== "live") { /* ...error... */ }
```

There is no check of `draft.turnExpiresAt` anywhere in the function. It resolves the on-clock team's pick (queue-first, then best projection) and calls `makeDraftPick(slug, playerId, { autopick: true, expectPickIndex: draft.currentPickIndex })` at line 392. The client only calls this when the countdown reaches zero (`components/leagues/draft/draft-room.tsx`), but that is not server-enforced — any member can invoke the server action directly and burn another manager's clock.

`drafts.turnExpiresAt` is a nullable timestamp column set by `computeTurnExpiresAt` in `lib/leagues/draft/pick.ts:282-284`; it is `null` when the draft has no pick clock.

The existing membership check pattern in this file is the model to follow: early returns with `{ success: false, error: "..." }`.

### (c) Scoring rules validation

```ts
// lib/actions/league-settings.ts:421-445
export async function updateScoringRules(
  slug: string,
  scoringRules: ScoringRuleDefinition[],
): Promise<ActionResult> {
  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  await db
    .update(leagueSeasons)
    .set({
      settings: {
        ...season.settings,
        scoringRules,
      },
    })
    .where(eq(leagueSeasons.id, season.id));
  ...
```

No Zod parse. Sibling actions in the same file DO validate (e.g. `updateLineupLockMode` at line 494 uses `lineupLockModeSchema.safeParse`). Zod v4 is installed.

The type to validate against (`lib/leagues/scoring/types.ts:38-52`):

```ts
export type ScoringRuleDefinition = {
  id: string;
  category: ScoringCategory;   // "passing" | "rushing" | "receiving" | "kicking" | "returning" | "defense" | "misc"
  kind: ScoringRuleKind;       // 17-value union, lines 14-31 of types.ts
  points: number;
  stat: string;
  every?: number;
  rate?: number;
  threshold?: number;
  maxThreshold?: number;
  minYards?: number;
  maxYards?: number;
  exactValue?: number;
  positions: ScoringPosition[]; // "QB" | "RB" | "WR" | "TE" | "K" | "DEF"
};
```

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Typecheck | `pnpm exec tsc --noEmit`         | exit 0              |
| Tests     | `pnpm test`                      | 0 fail              |
| Lint      | `pnpm lint`                      | 0 errors            |
| Audit     | `pnpm audit --prod`              | see per-step        |
| Build     | `pnpm build`                     | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `package.json`, `pnpm-lock.yaml`
- `lib/actions/draft.ts` (only `autoDraftCurrentPick`)
- `lib/actions/league-settings.ts` (only `updateScoringRules`)
- `lib/leagues/scoring/schema.ts` (create)
- `lib/leagues/scoring/schema.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `makeDraftPick` / `commitDraftPick` — the pick commit path is covered by plans 009/011-adjacent work; do not add clock logic there.
- `components/leagues/draft/draft-room.tsx` — client behavior is already correct.
- Other advisories' transitive deps (`sharp` comes with the Next bump; do not add manual `pnpm.overrides` unless step 1's fallback says so).
- Any other action in `league-settings.ts`.

## Git workflow

- Branch: `advisor/008-security-patch-batch`
- One commit per step; message style: single imperative sentence with a period.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Bump Next.js if the patched version is published

Check availability: `pnpm view 'next@>=16.2.11 <16.3.0' version`

- **If it returns a version** (e.g. `16.2.11`): update `package.json` to that exact version for both `next` and `eslint-config-next`, run `pnpm install`, then `pnpm build`.
- **If it returns nothing / errors**: the patch is not yet published. Skip the bump, note `BLOCKED (next@16.2.11 unpublished)` for this step in `plans/README.md`, and continue with Step 2 — the remaining steps do not depend on it. Do NOT upgrade to a 16.3 canary/preview.

**Verify** (only if bumped): `pnpm build` → exit 0; `pnpm audit --prod 2>&1 | grep -c "GHSA-m99w"` → `0`. Smoke: `pnpm dev` starts and `/` renders.

### Step 2: Move `shadcn` to devDependencies

In `package.json`, move `"shadcn": "^4.13.0"` from `dependencies` to `devDependencies`, then `pnpm install`.

**Verify**: `pnpm audit --prod 2>&1 | grep -c "fast-uri"` → `0`. `pnpm build` → exit 0 (the CLI is not imported by app code — `grep -rn "from \"shadcn\"" app components lib` → no matches).

### Step 3: Enforce the pick clock in `autoDraftCurrentPick`

> **Refined 2026-07-23 after execute STOP**: the original "untimed → commissioner only" rule
> would break a legitimate caller. `components/leagues/draft/draft-room.tsx:262-290` fires
> `autoDraftCurrentPick` for **any** league member when the on-clock team is an open/unclaimed
> slot (`onClockTeam.userId == null`) **and** the pick clock is disabled (`!clockEnabled`).
> Server-side, `pickTimeLimitSeconds <= 0` leaves `draft.turnExpiresAt` permanently `null`
> (`lib/leagues/draft/clock.ts:computeTurnExpiresAt`). The gate below preserves that flow.

In `lib/actions/draft.ts`, place the guard **after** the schedule/`slot` resolution (after the
`if (!slot) return { success: true }` early return around line 335–338) so the on-clock team
is known. `seasonTeams` rows already include `userId` (see `getSeasonDraftTeams` /
`SeasonDraftTeam` in `lib/leagues/action-context.ts`).

```ts
const onClockSeasonTeam = seasonTeams.find((team) => team.id === slot.teamId);
const isOpenSlot = onClockSeasonTeam?.userId == null;
const clockExpired =
  draft.turnExpiresAt != null && draft.turnExpiresAt.getTime() <= Date.now();

if (!isCommissioner) {
  if (draft.turnExpiresAt != null) {
    // Timed draft: members may only trigger once the clock has hit zero.
    if (!clockExpired) {
      return {
        success: false,
        error: "The pick clock has not expired yet.",
      };
    }
  } else if (!isOpenSlot) {
    // Untimed draft: members may only autopick open/unclaimed slots
    // (draft-room.tsx open-slot effect). Claimed seats need commissioner.
    return {
      success: false,
      error: "Only the commissioner can force an autopick on a claimed seat when there is no pick clock.",
    };
  }
}
```

Rules encoded:
- Commissioner: always allowed.
- Timed draft (`turnExpiresAt` set): members only after expiry (covers the countdown→0 effect).
- Untimed draft (`turnExpiresAt` null): members only for open/unclaimed on-clock seats; claimed seats are commissioner-only.

Do **not** change `draft-room.tsx`. Keep the existing `autopickAllowed` check that follows.

**Verify**: `pnpm typecheck` → exit 0. `pnpm lint lib/actions/draft.ts` → 0 errors.
`grep -rn autoDraftCurrentPick components/` still shows only the two draft-room sites (countdown + open-slot).

### Step 4: Create the scoring-rules Zod schema

Create `lib/leagues/scoring/schema.ts`:

```ts
import { z } from "zod";

import {
  SCORING_POSITIONS,
  SCORING_RULE_KIND_OPTIONS,
} from "@/lib/leagues/scoring/types";

const scoringCategorySchema = z.enum([
  "passing", "rushing", "receiving", "kicking", "returning", "defense", "misc",
]);

const scoringKindSchema = z.enum(
  SCORING_RULE_KIND_OPTIONS.map((option) => option.value) as [string, ...string[]],
);

const boundedNumber = z.number().finite().min(-1000).max(1000);
const boundedStatValue = z.number().finite().min(0).max(100_000);

export const scoringRuleDefinitionSchema = z
  .object({
    id: z.string().min(1).max(120),
    category: scoringCategorySchema,
    kind: scoringKindSchema,
    points: boundedNumber,
    stat: z.string().min(1).max(120),
    every: boundedStatValue.optional(),
    rate: boundedStatValue.optional(),
    threshold: boundedStatValue.optional(),
    maxThreshold: boundedStatValue.optional(),
    minYards: boundedStatValue.optional(),
    maxYards: boundedStatValue.optional(),
    exactValue: boundedStatValue.optional(),
    positions: z
      .array(z.enum(SCORING_POSITIONS as [string, ...string[]]))
      .max(SCORING_POSITIONS.length),
  })
  .strict();

export const scoringRulesPayloadSchema = z
  .array(scoringRuleDefinitionSchema)
  .max(200);
```

Adjust the enum-construction casts to whatever compiles cleanly under Zod v4 (e.g. `z.enum([...])` with literal arrays) — the load-bearing requirements are: `.strict()` objects (reject unknown keys), bounded numbers (`finite`, sane min/max), bounded string lengths, and a max array length.

**Verify**: `pnpm typecheck` → exit 0.

### Step 5: Parse in `updateScoringRules`

In `lib/actions/league-settings.ts`, at the top of `updateScoringRules` before `getCommissionerSeason`:

```ts
const parsed = scoringRulesPayloadSchema.safeParse(scoringRules);
if (!parsed.success) {
  return { success: false, error: "Invalid scoring rules payload." };
}
```

Then persist `parsed.data` (cast to `ScoringRuleDefinition[]` if the inferred type differs) instead of the raw argument. Follow the exact pattern of `updateLineupLockMode` in the same file (line ~494): safeParse → early error return → use `parsed.data`.

**Verify**: `pnpm typecheck` → exit 0. `pnpm lint lib/actions/league-settings.ts` → 0 errors.

## Test plan

Create `lib/leagues/scoring/schema.test.ts`, modeled structurally on `lib/leagues/waivers/waivers.test.ts` (node:test + `assert/strict`, `describe`/`it`):

- accepts a valid rule (copy a real default rule shape from `lib/leagues/scoring/build-rule.ts` or construct: `{ id: "pass-yds", category: "passing", kind: "yards_per_every", points: 1, stat: "pass_yd", every: 25, positions: ["QB"] }`)
- rejects unknown keys (`{ ...valid, evil: true }`)
- rejects non-finite points (`Infinity`, `NaN`)
- rejects an array longer than 200
- rejects an invalid `kind` / `category` / `position`

The clock-gate change in `autoDraftCurrentPick` cannot be unit-tested without the DB harness (plan 009); its regression test is listed in plan 009's suite. Manual check here: from a non-commissioner session, calling autopick while a turn is active must return "The pick clock has not expired yet."

**Verification**: `pnpm test` → 0 fail, including the new schema tests.

## Done criteria

- [ ] `pnpm audit --prod` shows no `fast-uri` advisory; no `next` advisories if Step 1 bumped
- [ ] `autoDraftCurrentPick` returns an error for non-commissioners while `turnExpiresAt` is in the future
- [ ] `updateScoringRules` rejects a payload with unknown keys or `Infinity` points
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass
- [ ] `pnpm build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated (note Step 1 BLOCKED state if applicable)

## STOP conditions

Stop and report back (do not improvise) if:

- The Next.js bump causes any build error or changed runtime behavior — report the error rather than patching app code to fit.
- `pnpm build` fails after moving `shadcn` to devDependencies (would mean something imports the CLI at runtime — investigate and report, don't move it back silently).
- You find an additional `autoDraftCurrentPick` call site beyond the two known draft-room effects (countdown→0, and open-slot when `!clockEnabled`) that would be broken by the refined Step 3 gate — report it rather than loosening further.
- The scoring settings UI (`components/leagues/scoring/`) sends a payload shape that fails the new schema for legitimate saves — loosen only the specific failing bound, and note it.

## Maintenance notes

- When Next 16.2.11+ publishes (if blocked at execution time), the bump is a one-line follow-up; re-run `pnpm audit --prod`.
- Reviewers should scrutinize the clock rule: commissioner-always-allowed is intentional; untimed open-slot member autopick is also intentional (refined after the first execute STOP). Do not collapse back to "untimed → commissioner only."
- Future scoring-rule kinds must be added to both `types.ts` and `schema.ts` — they are now intentionally coupled.
