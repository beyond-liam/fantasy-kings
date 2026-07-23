# Fantasy Kings — Project Specification

> Living document. Update this file as requirements, decisions, and scope change.
> Last updated: 2026-07-23

---

## 1. Vision

A mobile-first fantasy football web app for a private friend group (8–16 users per league). Built to fix frustrations with existing platforms (Sleeper, ESPN, Fantrax): not data-rich enough, gimmicky, not easy to use, and — ultimately — no granular IDP position support.

**Long-term differentiator:** True positional flexibility (EDGE/DT/LB/CB/S as distinct positions), not bucketed categories like DL/LB/DB. IDP remains deferred; offense scoring and league rule customization are in progress.

**This is not a prototype.** Build for correctness and maintainability within scope, but do not gold-plate beyond it.

---

## 2. Operating Rules

These apply for the entire project:

1. **Plan before code.** Read this document and any referenced files before implementing.
2. **Smallest reviewable increments.** One schema domain, one API route, one UI component, or one feature slice at a time. Never sweep across many files in a single pass.
3. **Stop after each increment.** Summarize what changed, why, and what to check. Wait for explicit approval before continuing. Silence is not approval.
4. **Ask on ambiguity.** If the spec has a gap or a deviation from an established decision is needed, stop and ask — do not decide unilaterally.
5. **Free tier only.** Never introduce a paid service, paid tier, or paid API. Every dependency must have a genuinely free tier. Flag blockers rather than substituting silently.
6. **Running checklist.** Keep Section 12 updated as work completes.
7. **Typed mock data.** When building UI ahead of backend wiring, mock data must use Drizzle inferred types (e.g. `typeof players.$inferSelect`). Never invent ad hoc data shapes.

### Development Sequencing

- **Data first** for player-facing screens — import real player data, then build UI against the database.
- **Schema in parallel** — types and tables before ingest scripts.
- **UI on real data** once ingest is verified (Rankings was the first screen wired this way).
- **Typed mock data** only for screens that still lack backend wiring (matchups, trades, activity, draft).

---

## 3. Locked Tech Stack

Do not substitute without explicit approval.

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) | Single codebase, responsive |
| Hosting | Vercel (Hobby/free tier) | Private friend league — non-commercial terms OK |
| Database | Supabase Postgres (free tier) | 500MB DB / 5GB bandwidth / 50k MAU |
| Auth | Supabase Auth (magic link / OTP) | Passwordless only — no stored passwords |
| Realtime | Supabase Realtime | Live draft room (when built) |
| ORM | Drizzle | Domain-split schema files — see Section 8 |
| Historical stats | nflverse (nfl-data-py / nflreadr) | Free, open source — deferred |
| Live stats | ESPN unofficial public API | Free, no key — deferred |
| Live-poll scheduler | cron-job.org (external, free) | Every 2–5 min on game days → `/api/cron/sync-scores` |
| Player metadata | Sleeper `/v1/players/nfl` | Player pool + external IDs; daily refresh via seed script |
| Email | Brevo (free: 300/day) | Wired — draft + trade transactional alerts |
| Styling | Tailwind CSS | |
| Components | shadcn/ui | Copied into codebase, full styling ownership |
| Icons | Hugeicons free tier | `@hugeicons/react` + `@hugeicons/core-free-icons`, Stroke Rounded only |
| Fonts | **Figtree** (UI text) | Via `next/font` |
| Charts | Recharts | Installed; charts UI still deferred |
| Data fetching | Server Components + server actions | TanStack Query **deferred** until draft room / client cache needs it (not installed) |
| Client state | React local state | Zustand **deferred** until draft room / ephemeral client cache needs it (not installed) |

---

## 4. Locked Product Decisions

| Topic | Decision |
|---|---|
| Default league format | **Offense-only** (IDP later) |
| First format to build | **Redraft** (dynasty later) |
| Commissioner | **One** per league |
| Invites | **Shareable league link** (not email-invite flow for now) |
| Multi-league users | Yes — post-login dashboard / leagues list |
| Auth | Passwordless magic link / OTP via Supabase (**wired**) |
| UI reference | No mockup required — shadcn components, unstyled/minimal is fine |
| Branding | TBD — neutral shadcn dark-only for now |
| Scoring | **Offense engine + league rules UI shipped**; IDP scoring deferred |
| Supabase | **Set up** — `.env.local` configured |

---

## 5. Information Architecture

Two navigation contexts: **app-level** (user account) and **league-level** (inside a specific league).

### App-level navigation

| Route | Page | Description |
|---|---|---|
| `/dashboard` | Dashboard | Home — league picker, quick summary cards |
| `/leagues` | Leagues | List, create, join via shareable link |
| `/draft-room` | Mock Draft | Practice draft settings + live mock vs ADP bots |
| `/rankings` | Rankings | Player rankings (offense-first, DB-backed) |
| `/scores` | NFL Scores | **Real NFL** game scores (ESPN scoreboard) |
| `/scores/[gameId]` | Game | NFL game dashboard from ESPN summary (pre / live) |

### League-level navigation

Entered via dashboard league picker or `/league/[leagueId]` (6-char public id). Requires league membership.

| Route | Page | Description |
|---|---|---|
| `/league/[leagueId]` | League | League home — tabs: Standings, Stats, Playoffs, Rules, Scoring |
| `/league/[leagueId]/team` | My Team | Roster / lineup / watchlist |
| `/league/[leagueId]/team/[teamId]` | Other team | Another manager's roster (public team id) |
| `/league/[leagueId]/players` | Players | Rankings-style pool + Team/Action columns |
| `/league/[leagueId]/scores` | Matchups | **Fantasy** matchup scores |
| `/league/[leagueId]/scores/[matchupId]` | Game Centre | Fantasy matchup detail (6-char public id) |
| `/league/[leagueId]/trades` | Trades | Propose/review trades |
| `/league/[leagueId]/activity` | Activity | Chronological event log |
| `/league/[leagueId]/draft` | Draft Room | League draft |
| `/league/[leagueId]/settings` | Settings | League settings + scoring rules (commissioner) |

### UI labeling (avoid collisions)

Both contexts have "Scores" and "Draft Room". Use distinct labels in the UI:

- App: **"NFL Scores"** / **"Mock Draft"**
- League: **"Matchups"** or **"Fantasy Scores"** / **"League Draft"**

---

## 6. Full Functional Requirements

> Items marked **(deferred)** are in the long-term spec but not in the current build phase.

### Authentication

- Passwordless only: email one-time code (OTP) — **no stored passwords**
- First login: required onboarding modal (first name, last name, favourite NFL team)
- Open registration — anyone can create an account and create a league
- Post-login: dashboard; invite destinations preserved via `next`
- Post-auth `next` redirects allowlisted to same-origin relative paths

### Leagues & formats

- Multi-league, multi-tenant from day one
- Supports redraft (build first) and dynasty **(dynasty deferred)**
- 8–16 users per league
- Leagues are **private** — accessible only via commissioner invite link/code (no public discovery)
- Shareable invite: `/join/{inviteCode}` shows recruiting standings; managers **Claim Team** on an open row
- Create wizard persists season settings and creates all team slots upfront (`user_id` null until claimed)
- Join only while season status is `recruiting`
- Leagues page: Create League + Join League (code dialog); list is a table card (team, W/L/T/%/Strk/Rank, draft status)

### Scoring

- **Shipped / in progress:** offense presets (standard / half PPR / full PPR), custom rule definitions, league scoring settings UI, rankings + league players scored via `lib/leagues/scoring`
- **Deferred:** IDP presets and granular IDP stat categories (solo/assist, sacks, TFLs, etc.)
- Scoring rules scoped per league-season (`league_seasons.settings`)

### Data pipeline

- **Sleeper `/v1/players/nfl`** for active player pool (QB, RB, WR, TE, K, **DEF**)
  - Import only `active === true` players with an NFL `team` (rostered)
  - **DEF** = 32 active NFL team defenses (`fantasy_positions` includes `DEF`, `team` set)
  - Inactive/unrostered players are purged on each `pnpm db:seed:players` run
  - Stored in `players` + `player_external_ids` (provider: `sleeper`)
  - Bio fields: age, height, weight, college, jersey number (from Sleeper players payload)
  - Rankings/Players: fantasy points from league (or preset) scoring rules; filters (position/team/rookies) applied in SQL
  - Refresh players: `pnpm db:seed:players` · bulk scores: `pnpm db:seed:scores`
  - **Near-live week stats:** `/api/cron/sync-scores` (secured) upserts current-week Sleeper `stats` into `player_scores`; Vercel daily (Hobby) + cron-job.org every 2–5 min on game days
- nflverse for historical/weekly stats **(deferred)**
- ESPN unofficial API for live in-game **player** stats **(deferred)** — scoreboard/clock already used for win% progress
- cron-job.org as external scheduler for live score polling **(in use for sync-scores)**
- Graceful degradation: "scores recalculating" state, never hard failure **(deferred)**

### Draft

- Two engines: live draft room (real-time) and slow/async draft **(live room shipped; email/slow draft deferred)**
- Mock draft room at app level (practice)
- Fully customizable: snake vs linear, manual order edits **(snake/linear + pick clock + autopick honored in live room)**
- Auto-start at scheduled `draftStartAt` **(cron + draft-room client trigger)**
- Per-team autopick toggle (My Team → Settings); open/unclaimed slots forced onto autopick
- Pause preserves remaining pick-clock time (`turnExpiresAt` / `pausedSecondsRemaining`)
- **Email alerts (Brevo):** see Notifications; draft-specific:
  - Live draft: tomorrow + 15 minutes before start (`/api/cron/draft-reminders`)
  - Live **and** email/slow draft: draft starts, on deck, on the clock, draft ends

### Roster construction

- Three modes per league: offense-only, offense+IDP, full-custom **(offense-only first)**
- Configurable bench, IR, and taxi slots (create wizard)
- Positions as granular lookup table — IDP positions deferred
- `roster_players` exists for ownership map on league Players; Add/Cut/Trade mutations not shipped yet

### In-season management **(deferred)**

- Waivers: FAAB or standard rolling priority (commissioner-selectable)
- Trades: instant / 24-hour review / commissioner approval (commissioner-selectable)
- Future draft pick trading for dynasty leagues

### Season structure

- Create wizard captures team count, divisions, playoffs, draft timing **(shipped)**
- Full in-season playoff/tiebreaker engines **(deferred)**

### Stats & analytics

- League Stats tab: starter points by position (QB/RB/WR/TE/FLEX/K/D/ST), PF, and Optimum PF — scored data only (dashes until season is active); season rollup after weekly scoring ships
- League Rules tab: read-only key/value summary of season settings (roster, schedule, playoffs, waivers, transactions, draft, tiebreakers)
- League Scoring tab: read-only preset + category rule list from season scoring config
- Player trend graphs, matchup history, snap counts, target share, SOS ratings **(deferred)**
- League-wide power rankings and projected standings **(deferred)**

### Notifications & activity

- Chronological activity log of league events **(placeholder UI)**
- In-app bell dropdown shipped (trade + waiver producers)
- Email via **Brevo** **(wired)** — `lib/email/*` adapters; push optional later
- **League Alert** fan-out (`lib/alerts/`): Trade + Draft announce helpers resolve recipients once, then in-app + email adapters (`CONTEXT.md`)
- Auth OTP remains Supabase (not Brevo)
- Dedupe via `email_sends` table; email sends use `after()` except draft-reminder cron (sync)
- Live draft reminders: `/api/cron/draft-reminders` (use cron-job.org every ~5 min; Vercel Hobby daily backup only)
- **Email v1 scope (locked):**
  | Event | Recipients | Notes |
  |---|---|---|
  | Live draft tomorrow | League | Cron |
  | Live draft in 15 minutes | League | Cron |
  | Draft starts | League | Live + email/slow draft |
  | On deck | That manager | Live + email/slow draft |
  | On the clock | That manager | Live + email/slow draft |
  | Draft ends | League | Live + email/slow draft |
  | Trade proposal | Counterparty | |
  | Trade accepted (review/veto window) | League | So managers can veto |
  | Trade vetoed | Both sides | |
- Out of email v1 (in-app only for now): waiver results, matchup W/L, adds/drops, injuries, every pick broadcast
- No built-in chat/social layer

### Historical data

- Schema must support season archives, all-time H2H, trophy room, career stats, draft history
- Deep-history browsing UI is post-MVP

### Platform

- Mobile-first responsive web app — no native apps
- Deployed on Vercel (Hobby/free tier)
- Package manager: **pnpm** only

---

## 7. MVP Build Order

### Phase 0 — Foundation

| Inc | Deliverable |
|---|---|
| 0.1 | `docs/PROJECT_SPEC.md` (this file) |
| 0.2 | Install deps: Drizzle, Supabase, shadcn, Hugeicons (Query/Zustand deferred) |
| 0.3 | Supabase project + env vars + Drizzle config |
| 0.4 | App shell: top nav (app-level), league side nav, Figtree |
| 0.5 | Schema: users, leagues, league_members, positions, players |
| 0.6 | Schema: `player_external_ids`, `sleeper_search_rank` on players |

### Phase D — Player data (before remaining UI)

| Inc | Deliverable |
|---|---|
| D.1a | Schema: `player_external_ids`, `sleeperSearchRank`, DEF position |
| D.1b | Sleeper ingest script (`db/seed/players-sleeper.ts`) |
| D.1c | Run `db:push`, seed positions + players; verify DEF = 32 |
| D.2 | Rankings page: shadcn data-table wired to DB |

### Phase 1 — App-level UI

| Inc | Page |
|---|---|
| 1.1 | App shell + routing (empty placeholder pages) |
| 1.2 | Dashboard (league picker) |
| 1.3 | Leagues (create / join via link) |
| 1.4 | Rankings **(wired to DB — D.2)** |
| 1.5 | Scores (NFL) |
| 1.6 | Draft Room (mock) |
| ~~1.7~~ | ~~Trade Analyzer~~ — **removed** (deferred; not in nav) |

### Phase 2 — League-level UI

| Inc | Page |
|---|---|
| 2.1 | League home (invite + membership) |
| 2.2 | My Team (watchlist-only for now) |
| 2.3 | Players (pool + ownership UI; mutations later) |
| 2.4 | Scores (fantasy matchups) — placeholder |
| 2.5 | Trades — placeholder |
| 2.6 | Activity — placeholder |
| 2.7 | Draft Room (league) — live (clock + autopick) |
| 2.8 | Settings + scoring rules |

### Phase 3 — Backend wiring (per approved screen)

Auth → league create/join → season settings → roster mutations → remaining screens.

### Phase 4+ — Deferred

IDP scoring, nflverse/ESPN pipeline, waivers (FAAB), playoffs engines, notifications, dynasty picks, push notifications, deep history UI, TanStack Query / Zustand when draft room needs them.

---

## 8. Schema Plan

### Conventions

```
db/
  schema/
    users.ts
    leagues.ts
    league-seasons.ts
    teams.ts
    roster-players.ts
    positions.ts
    players.ts
    player-scores.ts
    …
    index.ts
  seed/
drizzle.config.ts
lib/
  db.ts
```

### Domain priority

| Priority | Domain | Build now? |
|---|---|---|
| 1 | users, leagues, league_members, invite codes | Yes |
| 2 | positions (QB, RB, WR, TE, K, **DEF**, FLEX, BN, IR…) | Yes — offense + team DEF |
| 3 | players, player_external_ids, player_scores | Yes |
| 4 | league_seasons, teams, roster slots in settings | Yes |
| 5 | roster_players (ownership map) | Yes — mutations next |
| 6 | drafts, draft_picks, draft_settings | Schema/UI later |
| 7 | matchups, matchup_scores | Schema later, logic deferred |
| 8 | offense scoring rules (JSON + `lib/leagues/scoring`) | Yes |
| 9 | waiver_claims, dynasty draft picks | Defer |
| 10 | historical archive, trophies | Schema stubs only |

---

## 9. Explicitly Out of Scope (MVP)

- Predictive risk modeling / "% chance of hitting projection"
- CB-vs-WR shutdown coverage analytics (requires paid charting data)
- Deep historical archive browsing UI
- Contracts / salary-cap system
- **IDP** scoring and positions (current phase)
- nflverse / ESPN live data pipeline (current phase)
- Installing TanStack Query / Zustand before draft-room need

---

## 10. Risk Register

| Risk | Mitigation |
|---|---|
| ESPN live API is unofficial, no SLA | Graceful degradation UI, not hard failure |
| Vercel free tier only allows daily cron | cron-job.org triggers secured API route |
| Brevo 300 emails/day free cap | Draft/trade-only targeting; no league-wide pick spam; throttle if needed |
| Live ESPN vs finalized nflverse data may disagree | Label "live" vs "final" in UI |
| Draft room is highest-complexity feature | Ship slow draft before live draft if needed |

---

## 11. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Mock draft room — solo vs ADP bots, or friends in a lobby together? | **Resolved (MVP)** — solo vs need-aware ADP bots; friends lobby deferred |
| 2 | Trade Analyzer — standalone tool or connected to league trade proposals? | **Deferred** — route + nav removed; revisit later |
| 3 | Rankings source — Sleeper projections/stats scored with league/preset rules | **Resolved** |
| 4 | Shareable invite link — commissioner approval required, or open join? | **Resolved** — invite link/code opens recruiting page; Claim Team assigns a specific open slot; leagues private (no public discovery) |
| 5 | League home — standings + matchup only, or commissioner settings on same page? | **Resolved** — settings under `/league/[slug]/settings` |

---

## 12. Running Checklist

### Completed

- [x] Next.js + Tailwind + shadcn + Hugeicons scaffold
- [x] `docs/PROJECT_SPEC.md` created

### Phase 0 — Foundation

- [x] Core dependency install (Drizzle, postgres, drizzle-kit, dotenv, tsx)
- [x] Supabase project setup + env vars
- [x] Drizzle config + initial schema
- [x] Postgres hardening: pooler runtime URL, hot-path indexes, roster season unique, RLS deny-by-default for Data API
- [x] App shell (dual nav: app-level + league-level)
- [x] Schema: profiles, leagues, league_members, positions, players
- [x] Schema: `player_external_ids`, `sleeper_search_rank` on players
- [x] Schema: player bio fields (`age`, `height`, `weight`, `college`, `jersey_number`)
- [x] Player profile dialog (bio, projection, game log, transactions; no narrative outlook)
- [x] DEF position seeded (32 team defenses)
- [x] Sleeper player ingest (`pnpm db:seed:players`)
- [x] Rankings page (data-table, real DB data)

### Phase 1 — App-level UI

- [x] App shell + routing
- [x] Dashboard (league picker)
- [x] Leagues (create / join via link)
- [x] Rankings (DB-backed; SQL position/team/rookie filters)
- [x] Scores (NFL) — schedule list + game dashboard (ESPN summary, no mocks)
- [x] Draft Room (mock) — settings + live vs need-aware ADP bots
- [x] Trade Analyzer — **removed** from app (route + nav); deferred

### Phase 2 — League-level UI

- [x] League home (membership + invite card)
- [x] League Stats tab (starter position PF + Optimum PF; current week)
- [x] League Playoffs tab (seeded standings + cutoff line + bracket path)
- [x] League Rules tab (settings summary from season config)
- [x] League Scoring tab (preset + category scoring rules)
- [x] My Team (watchlist-only; roster/lineup later)
- [x] Players (pool + Team/Action UI; mutations later)
- [x] Settings + scoring rules UI
- [x] Scores (fantasy Matchups) — week matchup board
- [x] Trades — composer, transactions tab, processing, vetoes, history
- [x] Activity — league event log (waivers + trades)
- [x] Draft Room (league) — live room (mock layout, pick clock, queue→ADP autopick)

### Phase 3 — Backend wiring

- [x] Auth (email OTP + first-login onboarding)
- [x] League create + shareable invite link/code
- [x] Multi-league membership (list + join via code + Claim Team)
- [x] Offense scoring engine + league scoring settings
- [x] Roster Add / Claim / Cut mutations
- [x] Trade mutations + processing pipeline
- [x] In-app notifications (bell dropdown; trade + waiver producers)
- [x] Near-live Sleeper week stats sync (`/api/cron/sync-scores`)
- [x] Matchup result lock + standings from final H2H (`home_pts`/`away_pts`/`status`)
- [x] Leagues list W/L/Strk/Rank from final matchups

### Deferred

- [ ] IDP positions + scoring
- [ ] TanStack Query / Zustand (when draft room needs them)
- [x] Near-live Sleeper stats cron (`sync-scores`); nflverse / ESPN player-stat pipeline still deferred
- [ ] Waivers (FAAB + rolling) runtime
- [ ] Playoffs + tiebreakers engines
- [x] Email notifications (Brevo) — draft + trade set in §5 Notifications
- [x] **Draft email alerts** — tomorrow + 15 mins (live); start / on deck / on clock / end (live + email draft)
- [ ] Injury / matchup-result notification producers
- [ ] Dynasty picks

### Trades — follow-up (after initial ship)

- [x] **League veto workflow** (`allowVetoes`) — review-period votes, majority threshold, `vetoed` status
- [ ] **Transaction limits** — `transactionLimits` enum exists but numeric weekly/season caps not in schema; count trades when implemented
- [ ] **Configurable review duration** — settings only support fixed `review_24h`; Yahoo-style “keep open for N days” picker deferred
- [x] **Trade activity feed** — `league_activity` trade types; Activity page labels
- [x] **Trade emails (Brevo)** — proposal → counterparty; accepted (veto window) → league; vetoed → both sides
- [x] **Scheduled trade processor** — `/api/cron/process-trades` daily on Hobby + page-load fallback; use cron-job.org for frequent runs
- [ ] **Dynasty draft-pick trades** — player-only trades first; Draft Picks tab inventory later
- [x] **Counter-offers** — receiver can open composer prefilled from a pending trade; sending rejects the original
- [x] **Trade history** — collapsed section on Transactions tab + Trades page
- [x] **Trade Analyzer** — removed from product for now (Open Question #2 deferred)

---

## 13. Changelog

| Date | Change |
|---|---|
| 2026-07-08 | Initial spec created from project brief |
| 2026-07-08 | Updated IA: app-level vs league-level page structure |
| 2026-07-08 | Default format: offense-only redraft; scoring deferred |
| 2026-07-08 | Invites: shareable link; multi-league dashboard picker |
| 2026-07-08 | Font: Figtree (dropped Geist requirement) |
| 2026-07-09 | App shell: dual nav, all placeholder routes |
| 2026-07-09 | Direction: data-first; Sleeper player ingest before remaining UI |
| 2026-07-09 | Player positions: QB, RB, WR, TE, K, **DEF** (32 team defenses) |
| 2026-07-09 | Rankings wired to DB via Sleeper `search_rank`; `player_external_ids` table |
| 2026-07-12 | Docs sync: Query/Zustand deferred; offense scoring shipped; checklist matches routes; auth/join/scoring status corrected |
| 2026-07-16 | Commish Powers: Set Starting Lineups (any team) |
| 2026-07-16 | Commish Powers: Edit Waiver Order (DnD priority) |
| 2026-07-16 | Waivers: drag-reorder pending claims (`sortOrder`); one preferred award per team |
| 2026-07-16 | Trades: counter-offers from pending inbound trades via prefilled composer |
| 2026-07-16 | Trades: vetoes, accept drop picker, history, trade cron, activity labels |
| 2026-07-17 | Player profile dialog: bio fields from Sleeper; season projection + game log (no narrative outlook) |
| 2026-07-17 | Player profile header: NFL team colors + Sleeper-style layout (logo watermark, bio bar) |
| 2026-07-18 | In-app notifications: `notifications` table, bell dropdown (read/clear), trade + waiver producers |
| 2026-07-18 | Auth/join refactor: email OTP, onboarding modal, Claim Team on invite page, leagues Join code dialog |
| 2026-07-21 | Leagues list: table card with team name, W/L/T/%/Strk/Rank standings cols, draft status |
| 2026-07-21 | League home tabs: Standings, Stats, Playoffs, Rules, Scoring |
| 2026-07-21 | League Stats: position breakdown + PF / OPF (scored only; dashes pre-season) |
| 2026-07-21 | League Playoffs tab: seeded standings, cutoff line, tournament bracket path |
| 2026-07-21 | League Rules tab: read-only summary of season settings (roster, waivers, trades, draft, tiebreakers) |
| 2026-07-21 | League Scoring tab: read-only preset + category scoring rules |
| 2026-07-22 | Mock draft: settings (scoring / snake-linear / teams / slot / clock / roster) + live room vs need-aware ADP bots (defer K/DEF); client-only session |
| 2026-07-22 | Removed team theme pilots; restored neutral dark-only shadcn tokens |
| 2026-07-22 | NFL game page: ESPN summary (predictor, odds, leaders, injuries, form, standings, live box/plays); no mocks — real empty values, `-` on fetch/parse failure |
| 2026-07-22 | Matchups nav label; drop descriptive page subtitles; trades attention a11y |
| 2026-07-22 | Near-live scoring: `/api/cron/sync-scores` upserts current-week Sleeper stats; 60s stats cache TTL |
| 2026-07-22 | Matchups: “Scores updated” + LiveRefresh; persist final H2H pts; league standings from finals |
| 2026-07-22 | Leagues list: W/L/T/%/Strk/Rank from final matchups |
| 2026-07-22 | Matchup Game Centre URLs use 6-char `publicId` (UUID bookmarks redirect) |
| 2026-07-22 | Waivers: single process day (default Wed); claims lock 1h before 10:00 UTC |
| 2026-07-22 | Waivers: hard-lock players whose NFL game has started until next fantasy week |
| 2026-07-22 | League draft room: mock-style on-the-clock Card, server-aligned pick clock, queue→ADP autopick on expiry |
| 2026-07-22 | Draft auto-start at `draftStartAt` (`/api/cron/start-drafts` + room trigger); shared `DraftClockCard` |
| 2026-07-22 | Spec note: need Resend email alerts for live draft tomorrow + 15 mins before start |
| 2026-07-22 | Draft polish: per-team autopick toggle, pause-safe clock, open-slot autopick, post-draft season-live CTAs |
| 2026-07-22 | Email provider → Brevo; locked v1 email set (draft start/end/on-deck/on-clock for live + email draft; live T-24h/T-15m; trade proposal / accepted-for-veto / vetoed) |
| 2026-07-22 | Brevo wired: `lib/email/*`, `email_sends` dedupe, draft/trade hooks, `/api/cron/draft-reminders` |
| 2026-07-22 | Removed Trade Analyzer from nav and deleted `/trade-analyzer` route |
| 2026-07-23 | React perf: cron processAll* out of Server Actions; draft membership gate; dynamic DraftRoom/GameCentre/Recharts; parallel scores/home fetches |
| 2026-07-23 | Postgres hardening: runtime uses pooler `DATABASE_URL`; hot-path indexes; `roster_players.league_season_id` + rostered unique; RLS enabled (no Data API policies) |
| 2026-07-22 | League Alert module (`lib/alerts/`): dual-channel fan-out for trades + draft; `CONTEXT.md` |
| 2026-07-22 | Extract Pick domain module: `commitDraftPick` in `lib/leagues/draft/pick.ts`; action stays thin adapter |
| 2026-07-22 | Extract Waiver Process: `processSeasonWaivers` + roster-writes helpers under `lib/leagues/waivers/` |
| 2026-07-16 | Trades: initial implementation started; follow-up items documented (vetoes, limits, cron, email) |
