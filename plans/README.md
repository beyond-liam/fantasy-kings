# Implementation Plans

Maintained by the improve skill. Execute in the order below unless dependencies say otherwise. Each executor: read the plan fully before starting, honor its STOP conditions, and update your row when done.

## Batch 2 — correctness & security audit (2026-07-23, planned at commit `e1e7f1e`)

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 007 | Make the verification baseline green and complete (test glob, lint, CI, typecheck) | P1 | M | — | DONE — worktree `advisor/007-verification-baseline` @ `487e251` |
| 008 | Patch Next.js advisories, gate autopick behind the clock, validate scoring-rule writes | P1 | S | — (007 recommended first) | DONE — worktree `advisor/008-security-patch-batch` @ `5e4c991` (Step 1 BLOCKED: next@16.2.11 unpublished; rest shipped) |
| 009 | PGlite test harness + characterization of draft/waiver/trade mutation cores | P1 | L | 007 | DONE — stack tip includes `63d34a6` (CI); worktree `advisor/011-trade-lifecycle-cas` |
| 010 | Atomic waiver awards and cut-and-add | P1 | M | 009 | DONE — `36f8acf` on `advisor/011-trade-lifecycle-cas` |
| 011 | Trade lifecycle compare-and-set + execute-before-complete + capacity re-check | P1 | M | 009 | DONE — worktree `advisor/011-trade-lifecycle-cas` @ `fab3989` |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (with one-line reason) | REJECTED (with one-line rationale)

### Dependency notes

- 009 requires 007 because the new `test:db` script slots into the green baseline and CI workflow 007 creates.
- 010 and 011 require 009 because they refactor exactly the code 009 characterizes, and each must flip a `CHARACTERIZATION OF KNOWN BUG` assertion 009 pins (the marker comments name the plan that flips them).
- 010 and 011 are independent of each other; 010 first is recommended (it adds the optional transaction-client param to `lib/leagues/roster-writes.ts` helpers).
- 008 is independent and can run any time; its Step 1 (Next.js bump) may be BLOCKED until `next@16.2.11` publishes — the rest of the plan proceeds regardless.

### Audit findings not planned this round (selected by maintainer on 2026-07-23)

Vetted and valid — re-plan on request:

- Lineup lock mode configured but never enforced on roster writes (`lib/leagues/lineup-lock.ts` vs `lib/actions/roster.ts`).
- Unauthenticated `getJoinPreview` performs DB writes (`ensureSeasonTeamSlots`) + ensure* round-trips on league-home reads (`lib/queries/leagues.ts:322-346, 403-413`).
- Scores page persists matchup scores on every GET (`app/league/[leagueId]/scores/page.tsx:180-182`).
- Game Centre loads full-week projections with no `playerIds` bound (`lib/queries/game-centre.ts:384-389`).
- Other-team page missed My Team's tab-scoped fetching (`app/league/[leagueId]/team/[teamId]/page.tsx:84-152`).
- Waiver processing lease / conditional claim updates against overlapping runs (`lib/cron/process-waivers.ts`).
- PROJECT_SPEC drift (shipped waivers/trades still marked deferred) + `.env.example` gitignored and missing `CRON_SECRET`/`BREVO_*` names.
- Direction options: wire schedule tab to real matchup results; finish League Alert migration for trade reject/cancel/complete; email/slow draft engine (or gate the option); playoff advancement engine.

### Findings considered and rejected (2026-07-23 audit)

- **Draft pick concurrency (CAS on `currentPickIndex`)**: already mitigated — `makeDraftPick` honors `expectPickIndex` (`lib/actions/draft.ts:239-244`) and unique indexes on `(draftId, overall)` / `(draftId, playerId)` prevent double-booking; worst case is a confusing error message.
- **Timing-safe `CRON_SECRET` comparison**: theoretical timing-leak; fail-closed behavior already correct.
- **Invite-code rate limiting / longer codes**: private friend-group app, ~40-bit random codes; revisit if the app ever opens up.
- **`pnpm audit` SSRF advisories (GHSA-89xv, GHSA-p9j2)**: require custom servers / rewrites — neither applies on Vercel with this config; resolved incidentally by the Next bump in plan 008.

---

## Batch 1 — performance audit (2026-07-14, planned at commit `5b6e84a`) — RETIRED

All six plans executed and verified DONE; the plan files were removed from the working tree on 2026-07-23. Record kept for numbering continuity:

| Plan | Title | Status |
|------|-------|--------|
| 001 | Add week-scoped index on `player_scores` | DONE |
| 002 | Server-filter rankings and league players queries | DONE |
| 003 | Trim `stats` keys on ranked player client DTOs | DONE |
| 004 | Scope My Team score loads to roster/watchlist IDs | DONE |
| 005 | Unblock league layout + add loading UI | DONE |
| 006 | Fix draft polling storms and full-page refresh | DONE |

Carried-forward follow-up from batch 1:

- **Live win probability**: Schedule "Chance" column uses projection + linear time-remaining × projection while games are live (`lib/leagues/win-probability`). Return once live scoring feeds are trusted — calibrate position σ, add pace blending, DNP/out detection, and OT handling against real in-game data. Search `TODO(live-win-prob)`.

Batch-1 rejections still standing (don't re-audit without cause): double middleware + RSC `getUser`; `revalidateSettingsPaths` shotgun; Recharts-in-bundle (DX cleanup, not perf); Supabase Realtime draft (documented direction — polling bridge shipped as 006).
