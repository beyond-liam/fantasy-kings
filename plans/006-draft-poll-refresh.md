# Plan 006: Fix draft polling storms and full-page refresh

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5b6e84a0e4895a6a3978ffca7b458953f803c968..HEAD -- components/leagues/draft/draft-pick-notifier.tsx app/api/league/\\[slug\\]/draft/picks/route.ts app/league/\\[slug\\]/layout.tsx`
> If mismatch vs Current state, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: stronger after Plans 002/003 (smaller pool if refresh remains); can ship alone
- **Category**: perf
- **Planned at**: commit `5b6e84a`, 2026-07-14

## Why this matters

While a draft is live/paused, `DraftPickNotifier` mounts on **every** league route and polls every 4s. Each new pick on the draft page calls `router.refresh()`, which re-runs the full draft RSC including `getRankedPlayers` for the entire pool. Overlapping intervals can stack requests. This makes draft night (and browsing other league tabs during draft) feel hitchy.

## Current state

```30:115:components/leagues/draft/draft-pick-notifier.tsx
  intervalMs = 4_000,
}: DraftPickNotifierProps) {
  // ...
    const poll = async () => {
      // fetch /api/league/.../draft/picks?after=...
      if (sawNewPick && pathnameRef.current?.includes(`/league/${slug}/draft`)) {
        router.refresh();
      }
    };

    const id = window.setInterval(poll, intervalMs);
    void poll();
```

API route is sequential auth/league/membership/season/draft (`app/api/league/[slug]/draft/picks/route.ts:19-66`).

Layout mounts notifier for all league pages when draft underway (`app/league/[slug]/layout.tsx`).

Spec (`docs/PROJECT_SPEC.md`): Supabase Realtime is the long-term live draft approach — **out of scope** here. This plan is an incremental poll/refresh fix; do not add Realtime.

TanStack Query / Zustand deferred — keep React local state + fetch.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | all pass |

## Scope

**In scope**:
- `components/leagues/draft/draft-pick-notifier.tsx`
- `app/api/league/[slug]/draft/picks/route.ts` (parallelize lookups only)
- Props plumbing from layout / `DraftNotifierSlot` if Plan 005 created a slot — update that call site
- `plans/README.md`

**Out of scope**:
- Rewriting `DraftRoom` into a fully client-state board (large)
- Supabase Realtime migration
- Changing pick toast UI
- Expanding poll JSON with full draft board (unless minimal fields needed to **avoid** refresh — see Step 2 escape)

## Git workflow

- Branch: `advisor/006-draft-poll-refresh`
- Commit: `Throttle draft polls and stop full pool refresh on picks`
- Do NOT push/PR unless asked.

## Steps

### Step 1: Prevent overlapping polls

In `draft-pick-notifier.tsx`, replace `setInterval` with a recursive `setTimeout` that schedules the next tick **after** `poll` settles, or use an `inFlight` boolean that skips ticks while a request is open.

Also clear timeout/interval on cleanup (already clears interval).

**Verify**: reading the effect shows no bare `setInterval(poll)` without in-flight protection.

### Step 2: Split poll cadence by route

Behavior to implement:

| Context | Interval | On new picks |
|---------|----------|--------------|
| Path includes `/league/{slug}/draft` | 4_000 ms (keep) | Prefer **not** calling `router.refresh()` for routine picks |
| Other league paths | 12_000–15_000 ms | Toasts only (already); no refresh |

For the draft route refresh problem, use this **minimal** approach (required):

1. Stop calling `router.refresh()` on every `sawNewPick`.
2. Instead, dispatch a custom browser event, e.g. `window.dispatchEvent(new CustomEvent("draft-picks", { detail: data }))`.
3. In `components/leagues/draft/draft-room.tsx` (or the board child), add a small `useEffect` listener that calls `router.refresh()` **at most** once per event **batch**, debounced 500ms — OR, if that still hurts, call `router.refresh()` only when `data.status` changes or pick count crosses round boundaries.

**Preferred DONE bar**: no `router.refresh()` from the notifier at all when only picks arrive; refresh only when poll reports `status` changed (`live`↔`paused`↔`complete`). Document that the board may lag until user navigates / action returns unless Step 2b is done.

**Step 2b (required for acceptable UX)**: Wire draft room to refresh on the custom event **debounced**, so board updates without polling every soft-nav of the full tree from the notifier’s interval storms. One debounced `router.refresh()` per burst is still better than refresh-per-pick with overlapping polls; after Steps 1+3 this should be acceptable. If refresh remains too heavy, STOP and report — do not invent a full client board rewrite.

### Step 3: Parallelize the picks API route

In `app/api/league/[slug]/draft/picks/route.ts`, after `getSessionUser` and slug:

```ts
const league = await getLeagueBySlug(slug);
// then
const membership = await getLeagueMembership(...)
```

Refactor to:

```ts
const { slug } = await context.params;
const [user, league] = await Promise.all([getSessionUser(), getLeagueBySlug(slug)]);
```

Then membership; then `Promise.all` season+… season depends on league id. At minimum parallelize user+league; then membership; then season; then draft — or after membership:

```ts
const season = await getLeagueSeason(league.id);
const draft = season ? await getDraftBySeasonId(season.id) : null;
```

cannot fully parallelize season/draft. Do:

```ts
const [user, league] = await Promise.all([getSessionUser(), getLeagueBySlug(slug)]);
```

and keep the rest. Optionally after league:

```ts
const [membership, season] = await Promise.all([
  getLeagueMembership(league.id, user.id),
  getLeagueSeason(league.id),
]);
```

**Verify**: route still returns 401/403/404 correctly; `pnpm lint` clean.

### Step 4: Mark DONE

## Test plan

- Live or paused draft: notifier on `/team` polls slower; toasts still appear.
- On `/draft`, new picks update board within ~1s without stacking refresh storms.
- Complete/pause transitions still refresh or otherwise reflect status.

## Done criteria

- [ ] No overlapping poll requests
- [ ] Off-draft interval ≥ 12s
- [ ] Notifier does not `router.refresh()` on every pick unconditionally
- [ ] Picks API parallelizes user+league (and membership+season if safe)
- [ ] README DONE

## STOP conditions

- Board silently stale with no refresh path — must complete Step 2b or STOP.
- Tempted to add Realtime or Zustand — out of scope; STOP and note for direction.

## Maintenance notes

- Spec’s Realtime draft remains the end state; this plan is a bridge.
- Reviewer: watch for missed picks when tab backgrounded (browser timer throttling) — acceptable.
