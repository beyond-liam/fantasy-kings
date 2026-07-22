# Plan 005: Unblock league layout + add loading UI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5b6e84a0e4895a6a3978ffca7b458953f803c968..HEAD -- app/league/\\[slug\\]/layout.tsx components/leagues/league-layout-guard.tsx components/leagues/draft/draft-pick-notifier.tsx`
> If mismatch vs Current state, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `5b6e84a`, 2026-07-14

## Why this matters

Every `/league/[slug]/**` navigation awaits a serial chain in the layout (session → league → membership → season → draft) **before** returning `{children}`. There is **no** `loading.tsx` anywhere in the repo, so soft-nav shows a frozen chrome until the whole chain + page finish. Fix: don’t block children on draft-notifier data; show an immediate loading fallback.

## Current state

Blocking layout:

```21:56:app/league/[slug]/layout.tsx
  const { slug } = await params;
  const user = await getSessionUser();
  const league = user ? await getLeagueBySlug(slug) : null;
  const membership =
    user && league ? await getLeagueMembership(league.id, user.id) : null;

  let draftNotifier: React.ReactNode = null;
  if (user && membership && league) {
    const season = await getLeagueSeason(league.id);
    const draft = season ? await getDraftBySeasonId(season.id) : null;
    if (draft && isDraftUnderway(draft.status)) {
      draftNotifier = (
        <DraftPickNotifier ... />
      );
    }
  }

  return (
    <LeagueLayoutGuard params={params}>
      ...
        {children}
        {draftNotifier}
```

`LeagueLayoutGuard` (`components/leagues/league-layout-guard.tsx`) also awaits session/league/membership before returning children — leaf helpers are React `cache()`’d, but the await still gates streaming.

No `loading.tsx` under `app/` (confirmed).

Leaf queries already use `cache()`: `getLeagueBySlug`, `getLeagueMembership`, `getLeagueSeason`, `getDraftBySeasonId`.

Conventions: App Router RSC layouts; shadcn `Spinner` already used on rankings Suspense (`components/ui/spinner`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `pnpm lint` | exit 0 |
| Typecheck | `pnpm exec tsc --noEmit` | no new errors from your files |

## Scope

**In scope**:
- `app/league/[slug]/layout.tsx`
- New: `app/league/[slug]/loading.tsx`
- Optional: `app/league/[slug]/draft-notifier-slot.tsx` (async server component) **or** inline async child in the layout file
- `components/leagues/league-layout-guard.tsx` only if needed to avoid duplicate serial work (prefer keeping Guard as auth gate)
- Optional: `app/(main)/loading.tsx` for rankings/scores soft-nav — **allowed** if cheap copy of league loading
- `plans/README.md`

**Out of scope**:
- Changing draft poll behavior (Plan 006)
- Removing `LeagueLayoutGuard`
- Rewriting SideNav

## Git workflow

- Branch: `advisor/005-league-layout-loading`
- Commit: `Stream league pages without blocking on draft notifier`
- Do NOT push/PR unless asked.

## Steps

### Step 1: Add league segment loading UI

Create `app/league/[slug]/loading.tsx`:

```tsx
import { Spinner } from "@/components/ui/spinner";

export default function LeagueLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Spinner className="size-6" />
    </div>
  );
}
```

Match Spinner usage from rankings page. Keep minimal — no cards, no fake dashboard.

**Verify**: file exists; `pnpm lint` clean for it.

### Step 2: Extract draft notifier into an async child that does not block layout return

Refactor `app/league/[slug]/layout.tsx` so the **default export** returns shell + `{children}` without awaiting season/draft.

Pattern:

1. Layout awaits only what SideNav needs for `isCommissioner` **or** pass `slug` and let SideNav stay as today.
2. Mount `<Suspense fallback={null}><DraftNotifierSlot slug={slug} /></Suspense>` beside children.
3. `DraftNotifierSlot` (async server component) performs `getSessionUser` → membership → season → draft → maybe render `DraftPickNotifier`.

Because `getSessionUser` / `getLeagueBySlug` / `getLeagueMembership` are duplicated with Guard: that is OK — they are `cache()`d within the request.

Minimal commissioner bit: today’s layout uses `membership?.role === "commissioner"`. Options:

- Keep a short parallel `Promise.all([getSessionUser(), params])` then league+membership via `Promise.all` after slug known, **without** awaiting draft before return; OR
- Default `isCommissioner={false}` and load commissioner flag inside an async SideNav wrapper — **STOP and use the first option** if SideNav would flash wrong items.

Preferred concrete structure:

```tsx
export default async function LeagueLayout({ children, params }) {
  const { slug } = await params;
  const user = await getSessionUser();
  const league = user ? await getLeagueBySlug(slug) : null;
  const membership =
    user && league ? await getLeagueMembership(league.id, user.id) : null;

  return (
    <LeagueLayoutGuard params={params}>
      <div className="relative flex min-h-0 flex-1">
        <LeagueSideNav
          slug={slug}
          isCommissioner={membership?.role === "commissioner"}
        />
        <div className="ml-[4.5rem] ...">
          <ContentContainer>{children}</ContentContainer>
        </div>
        <Suspense fallback={null}>
          <LeagueDraftNotifierSlot slug={slug} />
        </Suspense>
      </div>
    </LeagueLayoutGuard>
  );
}
```

`LeagueDraftNotifierSlot`: only fetch season/draft when `user`+membership implied — it can re-check membership via cached helpers and return `null` if not underway.

**Verify**: `rg "getDraftBySeasonId" app/league/\\[slug\\]/layout.tsx` → **no matches** (moved to slot). Slot file contains the call.

### Step 3: Optional main loading

If time permits, add identical `app/(main)/loading.tsx` for `/rankings` nav feel. Not required for DONE.

### Step 4: Mark DONE

## Test plan

- Soft-nav between two league pages: loading spinner should appear (visual check).
- During a live draft, pick toasts still fire (notifier still mounts).

## Done criteria

- [ ] Layout does not await draft before returning children
- [ ] `app/league/[slug]/loading.tsx` exists
- [ ] Draft notifier still mounts when draft is live/paused
- [ ] SideNav commissioner state still correct (no false “hide settings”)
- [ ] README DONE

## STOP conditions

- Next.js version behaves differently and Suspense child never streams — report with Next 16.2 notes from `package.json`.
- Removing layout membership await breaks SideNav — do not remove commissioner fetch; only draft awaits move out.

## Maintenance notes

- Plan 006 will further reduce notifier cost.
- Reviewer: ensure Guard still redirects non-members before sensitive children paint (possible brief loading flash is OK).
