# Fantasy Kings — Project Specification

> Living document. Update this file as requirements, decisions, and scope change.
> Last updated: 2026-08-06

---

## 1. Vision

A mobile-first fantasy football web app for a private friend group (4–16 users per league). Built to fix frustrations with existing platforms (Sleeper, ESPN, Fantrax): not data-rich enough, gimmicky, not easy to use, and — ultimately — no granular IDP position support.

**Long-term differentiator:** True positional flexibility (EDGE/DT/LB/CB/S as distinct positions), not bucketed categories like DL/LB/DB. IDP remains deferred; offense scoring and league rule customization are in progress.

**This is not a prototype.** Build for correctness and maintainability within scope, but do not gold-plate beyond it.

---

## 1b. Status snapshot (2026-07-25)

### Shipped (use this as the source of truth)

| Area | What’s live |
|---|---|
| Auth / leagues | Magic link OTP, create/join, multi-league, settings |
| Scoring | Offense engine + commissioner scoring UI |
| Roster | Lineup / IR / taxi (eligibility), FA add/cut, lineup-lock enforce |
| Waivers / trades | FAAB + rolling, claims, vetoes, limits, crons, alerts |
| Draft | Live + email/slow same room; Brevo turn emails; mock draft |
| Matchups | Week board, Game Centre, standings from finals, Live/Final badges |
| Live scores | Sleeper near-live + ESPN athlete boxscores → `player_scores` |
| Official scores | nflverse post-week replace; optional `applyOfficialStatChanges` |
| Corrections UX | Activity `score_corrected` + owner notifications; Live freshness only when NFL games are in progress |
| Win% | Calibrated live chance on schedule/board (literature σ priors; re-fit is lowest-priority later) |
| Playoffs | Settings, bracket hydrate, first-round ensure, advance (4/6/8 + re-seed + byes + game TBs), two-week championship rematch + series totals + Champion crowning |
| Activity | Adds/drops, waivers, trades, IR/taxi, settings diffs, score corrections |
| Team UX | Roster summary panel, IR/taxi lock alerts, floating roster actions, suggested lineup |
| Notifications | In-app bell (with league name) + Brevo email v1 (draft + trade only) |
| Standings | FORM guide (last 5) replaces next-opponent column |
| Game Centre | Yet-to-play + scheduled Preview dashboard (predictor, leaders, injuries, H2H) |
| Playoffs standings | Seed only (no Rank column) |
| Messages | League threads + replies; nav unread red dot; mark all read |
| Engagement | SOS (season/remaining), playoff chance %, playoff picture badges, Game Centre Preview, Overview (spotlights + roast), HoF (titles + roast + extremes), Team H2H tab, Team Stats charts 1–4 + KPI strip |
| Empty states | shadcn `Empty` used for zero-data surfaces (charts, lists, spotlights, settings, dialogs, data-table) |
| Manager presence | Online / offline / inactive badges on current-manager identities; profile `last_seen_at` + throttled heartbeat + league poll |
| Player profiles | Canonical `/players/[playerId]`; league view uses `/league/[id]/players/[playerId]` (sidebar + Players active). `?league=` on the global route redirects into the league path. |

### Near-term product (build next)

| Item | Notes |
|---|---|
| Advanced player filtering | Richer filters beyond current position / team / rookies / FA toggles |

### Near-term bugs / fixes (tackle one by one)

| # | Item | Notes |
|---|---|---|
| ~~1~~ | ~~Login email existence UX~~ | **Done (2026-08-02)** — Log In maps Supabase “Signups not allowed for otp” to a clear “no account / switch to Register” message |
| 2 | Responsive control sizes | Use `useIsMobile` / breakpoints so dense mobile screens can use smaller shadcn sizes (`sm` buttons, triggers, inputs) without shrinking desktop |
| ~~3~~ | ~~Reschedule started draft~~ | **Done (2026-08-02)** — Saving a future `draftStartAt` unwinds `live`/`paused` → `scheduled` (keeps picks); clears underway UI and pickability; no-pick seasons return to `recruiting` |
| ~~4~~ | ~~Draft time picker timezone~~ | **Done (2026-08-02)** — `TimePicker` is native `Input type="time"` (minutes only); draft forms edit local `HH:mm` via `formatLocalTime` / `applyLocalTime`, persist ISO only |
| ~~5~~ | ~~Draft email delivery audit~~ | **Done (2026-08-02)** — Dedupe claims release on Brevo fail/skip; cron draft-start + trade-complete use `sync`; commissioner accept uses a separate dedupe key; `emailNotificationsEnabled` no longer forced `false` (column unused for gating). Ops: confirm `BREVO_*` on Vercel + cron-job.org every ~5m for `draft-reminders` / `start-drafts` |

### Engagement analytics (remaining)

| Item | Notes |
|---|---|
| Matchup insights | Positional edges, median/luck, bench/optimal delta, would-have-won alternate outcomes |
| Team Stats chart 6 | Win margins chart (optional; KPI strip covers averages) |
| Season rewind | End-of-year team/league recap |

### Explicitly deferred (do not schedule soon)

| Item | Priority | Notes |
|---|---|---|
| Dynasty picks + pick trades | Deferred | Come back later with dynasty format |
| IDP positions + scoring | Deferred | Long-term differentiator; not current phase |
| Player trend / snap / target share charts | Deferred | Paid/chart-heavy; Recharts installed but unused for this |
| Player strength of schedule | Shipped | Overview SOS wheel from positional fantasy pts allowed; distinct from team SOS on standings/playoffs |
| Win% σ re-fit from `player_scores` residuals | **Lowest** | Chance already shipped with literature priors; re-fit only after enough completed weeks — polish, not blocking |
| TanStack Query / Zustand | **Lowest** | Not installed; RSC + local state fine. Revisit only if draft-room polling/cache becomes painful — not a planned product slice |
| Web push notifications | **Lowest** | Optional later; DIY Web Push can stay free-tier. In-app + email v1 cover MVP |

### Permanently out of scope (do not build / do not revisit)

- Mock draft **friends lobby** — mock stays solo vs ADP bots only
- **Trade Analyzer** — route/nav removed; not coming back
- Separate **branding** track — ship with current dark-only shadcn + Figtree; no TBD rebrand workstream
- **Broader transactional email** beyond locked draft + trade set (waivers, matchup W/L, score corrections, adds/drops, injuries, every-pick broadcast stay in-app only)
- Activity-feed milestones; franchise pages across owner changes
- Deep unbounded historical archive browser (Hall of Fame plaques are in scope; full season-by-season archive explorer is not)

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

### Operations Documentation

See [`docs/ops/cron-runbook.md`](../ops/cron-runbook.md) for cron job setup, environment variables, and score sync pipeline operations.

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
| Historical stats | nflverse (nflreadr / player week CSVs) | Free, open source — **wired** post-week via `sync-scores` |
| Live stats | ESPN unofficial public API | Free, no key — **wired** (scoreboard + athlete boxscores → `player_scores`) |
| Live-poll scheduler | cron-job.org (external, free) | Every 2–5 min on game days → `/api/cron/sync-scores` |
| Player metadata | Sleeper `/v1/players/nfl` | Player pool + external IDs; daily refresh via seed script |
| Email | Brevo (free: 300/day) | Wired — draft + trade transactional alerts |
| Styling | Tailwind CSS | |
| Components | shadcn/ui | Copied into codebase, full styling ownership |
| Icons | Hugeicons free tier | `@hugeicons/react` + `@hugeicons/core-free-icons`, Stroke Rounded only |
| Fonts | **Figtree** (UI text) | Via `next/font` |
| Charts | Recharts | Installed; player-trend charts deferred; engagement charts when those features ship |
| Data fetching | Server Components + server actions | TanStack Query **not installed** — lowest priority; only if draft-room client cache pain appears |
| Client state | React local state | Zustand **not installed** — lowest priority; same bar as Query |

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
| UI reference | No mockup required — shadcn components |
| Visual system | Dark-only shadcn + Figtree — **no separate branding track** |
| Empty states | Always use shadcn **`Empty`** (`components/ui/empty`) wherever an empty/zero-data state is shown |
| Manager presence | Profile-level last seen; show only on current manager identities — never unclaimed teams, historical records, or public invite previews |
| Scoring | **Offense engine + league rules UI shipped**; IDP scoring deferred |
| Mock draft | Solo vs need-aware ADP bots only — **no friends lobby** |
| Trade Analyzer | **Removed permanently** (not deferred) |
| Email scope | Brevo **locked** to draft + trade alerts — no broader email expansion |
| Push notifications | **Lowest priority** deferred (optional Web Push later; free DIY path OK) |
| Win% calibration | Live Chance **shipped**; σ re-fit from residuals = **lowest priority** |
| TanStack Query / Zustand | **Lowest priority** — do not install until draft-room pain warrants it |
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
| `/league/[leagueId]` | League | League home — tabs: Overview, Standings, Power Rankings, Stats, Playoffs, Hall of Fame, Rules, Scoring |
| `/league/[leagueId]/hall-of-fame/champions` | Champions | Season-by-season championship winners |
| `/league/[leagueId]/hall-of-fame/regular-season` | RS titles | Season-by-season regular-season #1 finishes |
| `/league/[leagueId]/hall-of-fame/division-titles` | Division titles | Division winners by season (filter by division) |
| `/league/[leagueId]/team` | My Team | Roster / lineup / watchlist |
| `/league/[leagueId]/team/[teamId]` | Other team | Another manager's roster (public team id); **Head-to-Head** tab vs viewer’s team when shipped |
| `/league/[leagueId]/players` | Players | Rankings-style pool + Team/Action columns |
| `/league/[leagueId]/scores` | Matchups | **Fantasy** matchup scores |
| `/league/[leagueId]/scores/[matchupId]` | Game Centre | Fantasy matchup detail (6-char public id) |
| `/league/[leagueId]/trades` | Trades | Propose/review trades |
| `/league/[leagueId]/messages` | Messages | League threads / replies |
| `/league/[leagueId]/messages/[threadId]` | Thread | Message thread detail |
| `/league/[leagueId]/activity` | Activity | Chronological event log |
| `/league/[leagueId]/draft` | Draft Room | League draft |
| `/league/[leagueId]/settings` | Settings | League settings + scoring rules (commissioner) |

### UI labeling (avoid collisions)

Both contexts have "Scores" and "Draft Room". Use distinct labels in the UI:

- App: **"NFL Scores"** / **"Mock Draft"**
- League: **"Matchups"** or **"Fantasy Scores"** / **"League Draft"**

### UI empty states (required)

Wherever the UI shows that there is nothing to display yet (no rows, no charts, no messages, no schedule, filtered-out lists, missing entitlements, etc.), compose **only** the shared shadcn **`Empty`** primitive from `components/ui/empty` (`Empty` / `EmptyHeader` / `EmptyTitle` / `EmptyDescription` / `EmptyMedia` / `EmptyContent`). Do **not** add wrapper components or one-off empty UIs (plain muted paragraphs, ad-hoc centered copy).

Two variants via the `Empty` **`size`** prop:

1. **Default page/list empties** (`size` omitted or `"default"`) — dashed border is built into `Empty`; do not add redundant `border border-dashed` or oversized padding overrides. Must include `EmptyMedia variant="icon"` with a Hugeicons icon, `EmptyTitle`, and `EmptyDescription`. Add `EmptyContent` with icon-leading `Button`(s) when a useful next action exists.
2. **Compact card/spotlight empties** (`size="sm"`) — stat cards, `TeamSpotlight`, `PlayerSpotlight`, overview/HoF spotlights. No icon; short title plus explanatory description (typography handled by `size="sm"`).

**Exceptions:** `border-none` (no dashed box) is OK for menu dropdowns and full-page not-found style surfaces. Data-table empty rows may stay compact inside the table.

---

## 6. Full Functional Requirements

> Items marked **(deferred)** are in the long-term spec but not in the current build phase.

### Authentication

- Passwordless only: email one-time code (OTP) — **no stored passwords**
- First login: required onboarding modal (first name, last name, favourite NFL team)
- Open registration — anyone can create an account and create a league
- Post-login: dashboard; invite destinations preserved via `next`
- Post-auth `next` redirects allowlisted to same-origin relative paths
- Authenticated app activity updates profile `last_seen_at`; regular/postseason uses a 14-day inactivity threshold and preseason/offseason uses 30 days

### Leagues & formats

- Multi-league, multi-tenant from day one
- Supports redraft (build first) and dynasty **(dynasty deferred)**
- 4–16 users per league
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
  - Stored in `players` + `player_external_ids` (providers: `sleeper`, `espn`)
  - Bio fields: age, height, weight, college, jersey number (from Sleeper players payload)
  - Rankings/Players: fantasy points from league (or preset) scoring rules; filters (position/team/rookies) applied in SQL
  - Refresh players: `pnpm db:seed:players` · bulk scores: `pnpm db:seed:scores`
  - **Near-live week stats:** `/api/cron/sync-scores` (secured) upserts current-week Sleeper `stats` into `player_scores`; Vercel daily (Hobby) + cron-job.org every 2–5 min on game days
- nflverse for historical/weekly stats — post-week official import via `/api/cron/sync-scores` (auto when slate has no live games; `nflverse=0` to skip)
- ESPN unofficial API for live in-game **player** stats — scoreboard/clock for win% progress; athlete boxscores merge into `player_scores` via `/api/cron/sync-scores` (pass `espn=0` to skip)
- cron-job.org as external scheduler for live score polling **(in use for sync-scores)**
- Graceful degradation: when NFL games are **live**, show `Last updated: …` (xs); hide otherwise **(shipped)**

### Draft

- Two engines: live draft room (real-time) and slow/async draft **(both shipped — same draft room; email uses longer/optional clocks + Brevo turn alerts)**
- Mock draft room at app level (practice) — **solo vs need-aware ADP bots only**; no friends lobby
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
- Taxi eligibility by years of experience (rookies → 5+) **(shipped)**
- Positions as granular lookup table — IDP positions deferred
- Roster mutations shipped (lineup, IR/taxi, free agency add/cut, waiver claims)

### In-season management

- Waivers: FAAB or rolling priority — processing, claims UI, cron + commissioner force-run **(shipped)**
- Trades: instant / 24h review / commissioner approval — propose, counter, veto, cron complete **(shipped)**
- Future draft pick trading for dynasty leagues **(deferred)**
- Lineup lock (first game / individual) enforced on roster writes **(shipped)**

### Season structure

- Create wizard captures team count, divisions, playoffs, draft timing **(shipped)**
- Playoff bracket UI + first-round / advance matchup ensure on score sync **(shipped)**
- Rank tiebreakers (H2H / PPG / schedule strength) + game tiebreakers (TDs / high starter / bench) + re-seed after each round **(shipped)**
- Two-week championship rematch, series totals, and Champion crowning on the bracket **(shipped)**

### Stats & analytics

- League Stats tab: starter points by position (QB/RB/WR/TE/FLEX/K/DEF), PF, and Optimum PF — **week positional breakdown** (column menu uses plain English; DEF not D/ST)
- Season PF/OPF available via `team_week_stats` for standings/analytics paths
- Playoff bracket hydrates from live matchup scores; advance pairs byes correctly; point ties use game tiebreakers then higher seed
- League Rules tab: read-only key/value summary of season settings (roster, schedule, playoffs, waivers, transactions, draft, tiebreakers)
- League Scoring tab: read-only preset + category rule list from season scoring config
- Player trend graphs, snap counts, target share **(deferred)** — paid/chart-heavy; not required for engagement v1

### Engagement analytics (planned)

**Standings / playoffs**
- Form guide strip on standings (recent W/L/T)
- Strength of schedule (played + remaining opponents)
- Playoff chance % column on Playoffs standings table
- Playoff picture: clinch / eliminate / bubble / magic number

**Matchups / Game Centre**
- Rivalry series history vs this opponent (W–L–T, avg margin, biggest/closest, streak)
- Last N meetings mini scoreboard
- Projected winner / projected margin; optional upset watch when close
- Positional edge board (slot-by-slot proj or live)
- Top projected / live starter each side
- Yet-to-play starters by kickoff
- Median / luck: beat-the-field that week
- Shared NFL games (correlation / stack risk)
- Injury / Out impact on starters
- Bench bombs / optimal-lineup delta (“points left on bench”) after finalize
- “Would have won” alternate outcomes where useful

**Other team page**
- Head-to-Head tab: career record vs viewer’s team, every meeting, avg margin, streaks, best/worst game
- Include “would have won” style alternate views where data allows

**League Overview**
- Standings glance, season spotlights, season leaders, POTW (shipped)
- Weekly roast row (updates each scored week): **Top Scorer** (highest PF that week), **Luckiest Winner** (lowest PF among winners), **Underachiever** (most bench points left + lost)

**Team page — Stats**
- Player Stats tab — roster position tables with league-wide ranks (shipped)
- Team Stats tab — secondary tab; chart dashboard (decision-first; see below)
- Roster Evaluation tab — secondary tab; roster strength / power evaluation (scaffold)

**Team Stats charts (decision lens)**  
Every chart/card must answer: *what does this tell me, and how do I improve roster / start-sit decisions?* Prefer league-relative signals over vanity totals.

Shipped:
1. **Points by week** — multi-line: your PF, league high / median / low each week (from finalized matchups). Headline: average weekly score. Season pulse; don’t overreact to one week below median.
2. **Points by position** — horizontal bars: share of your starter PF by slot vs league-average share; tooltip = points + %. Headline: strongest slot vs league share. Roster-construction signal (where to spend FAAB / trade).
3. **Matchup luck** — ± bars: actual H2H result minus all-play expected win% from weekly PF rank (`round((actual − expected) × 100)`). Positive = lucky; negative = unlucky. Zero-luck weeks show a tiny slate stub so the week stays visible. Headline: qualitative season luck (Lucky / Quite unlucky / …).
4. **Points left on bench** — weekly OPF − PF from `team_week_stats`; tooltip flags weeks where optimum would have flipped a loss. Headline: should-be (optimal) record vs actual.
5. **Scoring concentration** — top-3 starter PF share vs rest from week-locked lineup snapshots; headline = top-3 %. Star reliance → handcuffs/depth; flat → can trade a stud for two starters.

KPI strip (shipped):
- **Average win margin** / **Average loss margin** — means from finals (no consistency)
- **Scoring consistency** — sample stddev as `+/- X` with excellent/good/fair/poor label inline

Optional / deferred:
6. **Win margins** chart — weekly +/− bars; KPI strip covers averages already.

Planned KPI / metric cards (supporting, not chart-worthy):
- PF / PPG / PF rank; games swung by start/sit; bench pts left (season + /wk); boom/bust weeks (above/below median); SOS / opp PF faced; closest win / worst loss; top position share teaser; season net luck / expected vs actual record

Layout (target): Margin KPI strip → 2×2 chart grid (week / position / luck / bench) → concentration

Explicitly out of Team Stats v1: radar/H2H vibe charts, OPF-vs-OPF as headline record, player snap/target trends (deferred/paid). Distinguish from HoF “Luckiest” (opponent OPF) and Overview “Luckiest Winner” (lowest PF among winners).

**Hall of Fame (league museum)** — serious plaques
- Playoff champions (true winners) + runner-up by season
- Regular-season champions (#1 seed / best record)
- Points champions: most PF, most PA, highest single-week team score
- Multi-title / drought callouts
- All-time standings (career W–L–T, win%, PF across seasons — team continuity as stored today; no separate franchise pages)

**Hall of Fame — roast / funny awards**
- Toilet bowl / last place (Sacko)
- Paper champion (most PF, missed playoffs or early exit)
- Soft schedule (strong record, weak SOS / PA)
- Bench warmer (most points left on bench)
- Waiver wire wizard (biggest FA/waiver scoring impact)
- Trade deadline hero / villain (post-trade PF swing)
- Close-game king / choke artist (record in ≤N-pt games)
- Blowout merchant (largest avg margin of victory)
- Monday night miracle / collapse (biggest lead blown or deficit overcome — approximate if progressive scores limited)
- Iron man (fewest moves / most original drafted starters still starting late)
- Injury magnet (most IR / Out starter weeks)
- Rivalry of the year
- Single-game museum: highest score, lowest winning score, biggest blowout, highest-scoring loser

**Season wrap**
- Season rewind / end-of-year recap page for each team (and optional league rollup)

**Explicitly not in this pass**
- Activity-feed milestones (first title, 100th league win, etc.)
- Franchise pages documenting owner changes across years

### Notifications & activity

- Chronological activity log of league events **(shipped)** — adds/drops, waivers, trades, IR/taxi, membership, commissioner settings changes (click for before/after), **score corrections**, **draft picks / pick reverts**
- In-app bell dropdown shipped (trade + waiver + matchup-result / score-correction producers); **league name on each notification** planned (near-term)
- Email via **Brevo** **(wired)** — `lib/email/*` adapters; scope **locked** to draft + trade only (no expansion)
- **League Alert** fan-out (`lib/alerts/`): Trade + Draft + Matchup announce helpers resolve recipients once, then in-app + email adapters (`CONTEXT.md`)
- Auth OTP remains Supabase (not Brevo)
- Dedupe via `email_sends` table; email sends use `after()` except draft-reminder cron (sync)
- Live draft reminders: `/api/cron/draft-reminders` (use cron-job.org every ~5 min; Vercel Hobby daily backup only)
- **Email scope (locked — do not expand):**
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
  | Trade rejected / cancelled / completed | Affected managers | League Alert helpers |
- **In-app only (never email):** waiver results, matchup W/L, score corrections, adds/drops, injuries, every pick broadcast
- **Web push:** lowest-priority optional later (DIY Web Push can stay free-tier); not scheduled
- **In-league messaging** shipped — threads/replies under `/messages`; nav unread red dot; mark all read; `@` mentions → bell notifications

### Historical data

- Schema should support season archives, all-time H2H, trophy room, career stats, draft history (stubs today)
- **Hall of Fame** UI is in scope (engagement); full unbounded archive browser is not

### Win probability

- Live Chance on matchup board / schedule **shipped** — position σ priors, pace blend, injury/soft DNP, live σ floor
- **σ re-fit** from projection vs actual residuals (`rmseByPosition`) = **lowest priority** after enough completed weeks; not blocking

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
| 0.2 | Install deps: Drizzle, Supabase, shadcn, Hugeicons (Query/Zustand not installed — lowest priority) |
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
| ~~1.7~~ | ~~Trade Analyzer~~ — **removed permanently** |

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

### Phase 4+ — Deferred / lowest priority

| Item | Priority |
|---|---|
| IDP scoring + positions | Deferred |
| Dynasty picks + pick trades | Deferred |
| Player trend / snap / target share charts | Deferred |
| Win% σ re-fit from residuals | **Lowest** |
| TanStack Query / Zustand | **Lowest** (only if draft-room pain) |
| Web push notifications | **Lowest** (optional free DIY Web Push) |

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
| 5 | roster_players (ownership map) | Yes — mutations shipped |
| 6 | drafts, draft_picks, draft_settings | Yes — live + email draft shipped |
| 7 | matchups (+ pts/status on row) | Yes — finalize + playoff ensure |
| 8 | offense scoring rules (JSON + `lib/leagues/scoring`) | Yes |
| 9 | waiver_claims, dynasty draft picks | Waivers shipped; dynasty picks defer |
| 10 | historical archive, trophies | Schema stubs only — Hall of Fame UI planned (§6 Engagement analytics) |

---

## 9. Explicitly Out of Scope

- CB-vs-WR shutdown coverage analytics (requires paid charting data)
- Deep unbounded historical archive browser (Hall of Fame plaques + awards are **in scope**)
- Franchise continuity pages / owner-change timelines
- Activity-feed milestones (league anniversaries, Nth win toasts, etc.)
- Contracts / salary-cap system
- **IDP** scoring and positions (current phase)
- Dynasty roster construction / draft-pick inventory (come back later)
- Mock draft **friends lobby**
- **Trade Analyzer** (removed permanently)
- Separate branding / rebrand workstream
- Expanding Brevo beyond locked draft + trade emails
- Installing TanStack Query / Zustand as a planned near-term slice
- Broader push/email notification fan-out for waivers, injuries, every draft pick, etc.

---

## 10. Risk Register

| Risk | Mitigation |
|---|---|
| ESPN live API is unofficial, no SLA | Soft freshness UI when games are live; never hard-fail the page |
| Vercel free tier only allows daily cron | cron-job.org triggers secured API route |
| Brevo 300 emails/day free cap | Draft/trade-only targeting; no league-wide pick spam; throttle if needed |
| Live ESPN vs finalized nflverse data may disagree | Live / Final status badges; optional official corrections + activity/notifications |
| Draft room is highest-complexity feature | Live + email share one room; clocks/autopick shipped |

---

## 11. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Mock draft room — solo vs ADP bots, or friends in a lobby together? | **Closed** — solo vs need-aware ADP bots only; friends lobby **out of scope** |
| 2 | Trade Analyzer — standalone tool or connected to league trade proposals? | **Closed** — removed permanently; do not revisit |
| 3 | Rankings source — Sleeper projections/stats scored with league/preset rules | **Resolved** |
| 4 | Shareable invite link — commissioner approval required, or open join? | **Resolved** — invite link/code opens recruiting page; Claim Team assigns a specific open slot; leagues private (no public discovery) |
| 5 | League home — standings + matchup only, or commissioner settings on same page? | **Resolved** — settings under `/league/[slug]/settings` |
| 6 | Hall of Fame — tab on league home vs dedicated `/hall-of-fame` route? | **Closed** — tab on league home (after Playoffs) |
| 7 | Playoff chance % method — heuristic vs simulation? | **Closed** — Monte Carlo on remaining schedule (PF/G logistic); picture uses win bounds |

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
- [x] Postgres best-practices follow-up: RLS on post-0009 tables; no DIRECT_URL runtime fallback; matchup FK/partial indexes; score-row hard cap; finalize batching
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
- [x] Draft Room (mock) — settings + live vs need-aware ADP bots (no friends lobby)
- [x] Trade Analyzer — **removed permanently** (route + nav)

### Phase 2 — League-level UI

- [x] League home (membership + invite card)
- [x] League Stats tab (starter position PF + Optimum PF; current week)
- [x] League Playoffs tab (seeded standings + cutoff line + bracket path)
- [x] League Rules tab (settings summary from season config)
- [x] League Scoring tab (preset + category scoring rules)
- [x] My Team (roster / stats / watchlist / schedule / transactions / draft picks / settings)
- [x] Players (pool + Team/Action + acquisition locks)
- [x] Settings + scoring rules UI
- [x] Scores (fantasy Matchups) — week matchup board + Live/Final + freshness
- [x] Trades — composer, transactions tab, processing, vetoes, history
- [x] Activity — league event log (waivers + trades + settings + score corrections)
- [x] Draft Room (league) — live room (mock layout, pick clock, queue→ADP autopick)

### Phase 3 — Backend wiring

- [x] Auth (email OTP + first-login onboarding)
- [x] League create + shareable invite link/code
- [x] Multi-league membership (list + join via code + Claim Team)
- [x] Offense scoring engine + league scoring settings
- [x] Roster Add / Claim / Cut mutations
- [x] Trade mutations + processing pipeline
- [x] In-app notifications (bell dropdown; trade + waiver + matchup producers)
- [x] Near-live Sleeper week stats sync (`/api/cron/sync-scores`)
- [x] ESPN live athlete boxscores merge on `sync-scores`
- [x] nflverse post-week official replace + `applyOfficialStatChanges`
- [x] Matchup result lock + standings from final H2H (`home_pts`/`away_pts`/`status`)
- [x] Leagues list W/L/Strk/Rank from final matchups
- [x] Playoff first-round ensure + single-week advance (4/6/8, byes, re-seed, game TBs)

### Deferred / remaining

**Near-term product**
- [ ] **Advanced player filtering** — richer filters beyond position / team / rookies / FA (DEFERRED)
- [x] **Manager presence** — online (2-min), offline, inactive (14d in-season / 30d offseason); avatar/name badges with tooltips
- [x] **Empty-state consistency** — use shadcn `Empty` everywhere zero-data is shown; migrate ad-hoc placeholders
- [x] **Form guide on league table** — last 5 results (FORM column replaces OPP); tooltips with opponent/score
- [x] **Remove rank from playoffs table** — seed only; drop redundant Rank column
- [x] **In-league messaging** — league threads/replies; nav unread red dot; mark all read; `@` mentions → bell notifications
- [x] **Yet-to-play breakdown** — Game Centre tooltip lists remaining unplayed starters
- [x] **Use suggested lineup** — button next to Update Roster; auto-set from projections
- [x] **Floating action bar** — sticky save/action bar when dirty (settings + always on My Team roster)
- [x] **League on notification popover** — show which league each notification belongs to

**Engagement analytics**
- [x] **Strength of schedule** — projected opponent win% on standings (season) + playoffs (remaining); same pre-season
- [x] **Playoff chance %** — Odds column (Monte Carlo on remaining schedule)
- [x] **Playoff picture** — Status badges (In / Bubble / Out) on playoffs table
- [x] **Matchup Preview (scheduled)** — Preview + Matchup tabs; predictor, season leaders, injury report, rivalry history, last 5
- [x] **League Overview** — standings glance (±2 neighbors); top scorer / worst D / inefficiency %; passing/rushing/receiving leaders (yards+TD fantasy pts); season leaders; POTW spotlights
- [ ] **Matchup insights (remaining)** — positional edges, median/luck, bench/optimal delta, would-have-won (DEFERRED)
- [ ] **Would have won** — alternate outcomes on matchup + H2H views (DEFERRED)
- [x] **Team Head-to-Head tab** — viewer vs other team series on other-team page
- [x] **Hall of Fame** — titles / RS / division / all-time / lucky / winning-score extremes; choke & Fergie via last-kickoff swings (current lineup + week actuals)
- [x] **Overview weekly roast row** — Top Scorer / Luckiest Winner (lowest PF + won) / Underachiever (most bench left + lost); shows after first scored week (dev-only `?mock=1`)
- [x] **Team page — Team Stats charts 1–5** — Points by week; Points by position; Matchup luck; Points left on bench (OPF−PF + flip weeks); Scoring concentration (top-3 share from lineup snapshots); chart headline metrics; margin KPI strip
- [ ] **Team page — Team Stats chart 6** — win margins chart (optional; KPI strip covers averages)
- [ ] **Season rewind** — end-of-year team/league recap

**Shipped playoff completion (kept for history)**
- [x] **Playoff two-week championship (backend)** — schedule Game 2 rematch; combined pts helper; hydrate copies both finalists
- [x] **Playoff two-week championship (UI)** — series totals on championship cards + Champion column crowning

**Deferred format / analytics**
- [ ] **Player strength of schedule** — remaining/season SOS for players (NFL opponent difficulty); revisit later; team SOS already shipped
- [ ] IDP positions + scoring
- [ ] Dynasty picks — deferred (come back later)
- [ ] **Dynasty draft-pick trades** — deferred with dynasty picks
- [ ] Player trend charts / snap / target share (DEFERRED)

**Lowest priority (do not schedule ahead of product/engagement)**
- [ ] Win% σ re-fit from `player_scores` residuals (needs completed weeks; Chance already shipped)
- [ ] TanStack Query / Zustand — only if draft-room polling/cache becomes painful
- [ ] Web push notifications — optional free DIY Web Push later

**UI consistency**
- [x] **Empty states** — audit all empty/zero-data surfaces; use shadcn `Empty` (`components/ui/empty`) only — no ad-hoc dashed boxes / muted paragraphs for those cases

### Trades — follow-up (after initial ship)

- [x] **League veto workflow** (`allowVetoes`) — review-period votes, majority threshold, `vetoed` status
- [x] **Transaction limits** — weekly/season numeric caps in settings + enforced on trades / FA adds
- [x] **Trade activity feed** — `league_activity` trade types; Activity page labels
- [x] **Trade emails (Brevo)** — proposal → counterparty; accepted (veto window) → league; vetoed → both sides
- [x] **Scheduled trade processor** — `/api/cron/process-trades` daily on Hobby + page-load fallback; use cron-job.org for frequent runs
- [x] **Counter-offers** — receiver can open composer prefilled from a pending trade; sending rejects the original
- [x] **Trade history** — collapsed section on Transactions tab + Trades page
- [x] **Trade Analyzer** — removed permanently (not deferred)

> Trade review stays fixed at **24 hours** (`review_24h`). Configurable multi-day review is out of scope.

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
| 2026-07-24 | Season-hardening: playoff bracket hydrate + 6-team advance/ties; activity feed types; scores updating banner; League Stats Week/Season PF; win% out/DNP + live σ floor + OT |
| 2026-07-24 | Settings activity feed + detail dialog; rank/game tiebreakers; playoff re-seed; season OPF via `team_week_stats`; pace-blended live win% |
| 2026-07-24 | Win% calibration: literature-based position σ, soft DNP, cleared stale live-win-prob TODOs |
| 2026-07-22 | League Alert module (`lib/alerts/`): dual-channel fan-out for trades + draft; `CONTEXT.md` |
| 2026-07-22 | Extract Pick domain module: `commitDraftPick` in `lib/leagues/draft/pick.ts`; action stays thin adapter |
| 2026-07-24 | Tech debt batch: lineup lock enforce; read-path ensure trim; scores GET no persist; GC FA bound; other-team tab scope; waiver lease/CAS; spec + `.env.example`; schedule W/L; trade alerts; gate slow draft; playoff advance foundation |
| 2026-07-24 | ESPN live athlete boxscores → `player_scores` (provider `espn` ids from Sleeper seed; merge on sync-scores cron) |
| 2026-07-24 | nflverse post-week official stats replace; `applyOfficialStatChanges` reopens finalized weeks for score corrections |
| 2026-07-24 | Matchup Live / Final status badges on scores list + Game Centre |
| 2026-07-24 | Score corrections: activity feed + owner notifications when finalized matchup pts change |
| 2026-07-24 | Spec status snapshot: shipped vs remaining; ESPN/nflverse marked wired; playoff two-week championship called out as next gap |
| 2026-07-24 | Playoff two-week championship backend: rematch Game 2 rows on ensure; hydrate keeps both finalists; combined winner helper |
| 2026-07-24 | Playoff bracket champion crowning + two-week series totals on championship cards |
| 2026-07-25 | Product backlog: advanced player filters, standings form guide, playoffs rank column removal, in-league messaging, yet-to-play breakdown, suggested lineup, floating action bar, league name on notification popover |
| 2026-07-25 | Engagement backlog: SOS, playoff chance %, playoff picture, matchup insights, would-have-won, team H2H tab, Hall of Fame (titles + roast awards), season rewind; exclude activity milestones + franchise pages |
| 2026-07-25 | Spec triage: near-term vs engagement vs deferred; permanently drop friends lobby, Trade Analyzer, branding track, broader email; lowest priority = win% σ re-fit, Query/Zustand, web push |
| 2026-07-25 | Ship near-term slices: league on notifications, yet-to-play tooltip, standings FORM guide, floating dirty actions, suggested lineup, FA “Owned by” copy fix |
| 2026-07-25 | In-league messaging v1: threads/replies, create dialog, unread nav red dot, mark all read; mentions → notifications deferred |
| 2026-07-25 | Message mentions: `@` member picker, bold tokens, `message_mention` bell notifications |
| 2026-07-25 | League home tabs: Overview (first) + Hall of Fame (after Playoffs); HoF content placeholder |
| 2026-07-25 | Engagement: season SOS on standings; remaining SOS + Odds + Status on playoffs; slim playoff cols (drop PF/PA/WP/BRM) |
| 2026-07-25 | Audit leftovers closed: lineup lock on FA add/cut + waiver award; schedule weeklyRank + other-team Chance; plans README status |
| 2026-07-25 | League Overview: standings glance, PF/PA/inefficiency, season leaders, POTW, TOTW |
| 2026-07-25 | Hall of Fame overview cards wired to season finals; drop `?mock=1` Overview/HoF fixtures |
| 2026-07-26 | HoF choke / Fergie: last-kickoff lead swings from current starters + week actuals + ESPN kickoffs |
| 2026-07-26 | Plan: Overview weekly roast row (Biggest Scorer / Luckiest Winner / Underachiever); team Stats Team Stats tab (charts TBC) |
| 2026-07-27 | Team Stats: Matchup luck chart (all-play expected win% vs H2H result) |
| 2026-07-27 | Team Stats: Points left on bench chart; zero-luck slate stubs |
| 2026-07-27 | Team Stats: chart headline metrics; avg weekly score moves off KPI strip |
| 2026-07-25 | Game Centre Preview: scheduled = Preview+Matchup; live/final = Matchup+Box; predictor/leaders/injuries/H2H |
| 2026-07-16 | Trades: initial implementation started; follow-up items documented (vetoes, limits, cron, email) |
| 2026-07-27 | Spec sync: move shipped engagement (SOS, playoff chance, HoF, roast, Team Stats 1–4, KPI strip) to shipped; mark margin KPI strip done; remove stale typed-mock sequencing; engagement remaining = advanced filters, matchup insights, concentration charts, season rewind |
| 2026-07-28 | Lineup snapshots: freeze starters at finalize so official score corrections re-score frozen starters instead of rewriting history from live roster |
| 2026-07-28 | Team Stats: scoring concentration chart (top-3 starter PF share from lineup snapshots) |
| 2026-07-28 | Architecture deepenings: Matchup finals/week-scoring modules; Team acquisition helpers; Team week history; Waiver → League Alert; Playoff decide-next-round; league-size bot names |
| 2026-07-28 | Perf: shared score-row cache + SQL filters; mock draft code-split + pool cap; lazy PlayerProfile/Game Centre dialogs; React.cache getNflState; parallel league layout guard |
| 2026-07-28 | Perf: league home Suspense tab panels; server-paginated rankings/players (50/page); Lighthouse smoke/league scripts + ops doc |
| 2026-07-28 | Postgres best practices: RLS on post-0009 tables; fail-fast DATABASE_URL; matchup FK/partial + secondary FK indexes; score-row hard cap; skip ranks on board/win%; finalize batching |
| 2026-07-28 | React best practices: parallelize nav/GC/action-context; React.cache hot helpers; Suspense account chrome + My Team tabs; slim GC payload; after() in-app alerts/mentions |
| 2026-07-28 | Empty-state consistency: migrate ad-hoc zero-data UIs to shadcn `Empty`; `size` default (icon+title+description+actions) vs `sm` compact cards/spotlights |
| 2026-07-29 | Manager presence: `profiles.last_seen_at`, heartbeat, league poll, badges on current-manager identities |
| 2026-07-29 | Deferred: player strength of schedule (distinct from team SOS on standings/playoffs) |
| 2026-07-30 | Player profile foundation: canonical player page + league-aware “View full profile” modal action |
| 2026-08-01 | Invite flow preserves `/join/[inviteCode]` through auth/onboarding; mobile league menu gets Join/Create actions; onboarding team picker shows logos |
| 2026-08-02 | Spec backlog: login email UX, mobile control sizes, reschedule started draft, draft time TZ picker, draft email delivery audit |
| 2026-08-02 | Login OTP maps unknown-email errors; saving a future draft start unwinds live/paused drafts |
| 2026-08-02 | Draft TimePicker matches shadcn native time input; local HH:mm editing (no UTC slice) |
| 2026-08-02 | Email delivery: release dedupe on Brevo fail; cron sync for draft start + trade complete; fix commissioner trade email dedupe |
| 2026-08-02 | Player page template: full-bleed team stadium/color hero, overlapping identity card (avatar + team badge, injury, actions, projection tiles) |
| 2026-08-03 | Player page right panel: Overview / Matchup / Game log tabs; Overview metrics (production, scoring breakdown, share, FPts by week, floor/ceiling, weekly finish, home/away + rest, matchup difficulty, vs leaders, multi-year) |
| 2026-08-03 | RB Overview scoring DNA: bucket points (rush/rec yards & TDs, receptions if PPR) + archetype labels (Workhorse / Three-down / Change-of-pace / TD dependent) |
| 2026-08-03 | Player Overview floor/ceiling: scoring consistency score (0–100 from weekly FPts CV) in card footer |
| 2026-08-03 | Player Overview SOS: playoff arc + buckets follow league calendar (RS end / championship), not hardcoded Wk 15–17 |
| 2026-08-03 | Player Overview SOS: Easy/Average/Hard counts include playoffs; donut colors use the same 3 buckets |
| 2026-08-03 | Player page: Season Production uses season stats only (never projections); mocks keep distinct projection vs YTD; identity card sticky on lg |
| 2026-08-03 | Player Overview: WR/TE scoring breakdown (rec yds → rush TD); weekly-finish barometer WR/RB 24, TE/QB 12 |
| 2026-08-03 | Player Overview: QB scoring breakdown (pass yds → rush TD); barometer Top 12 |
| 2026-08-03 | Player Overview: WR/TE/QB scoring DNA summaries (PPR-cushioned, TD-dependent, dual-threat, etc.) |
| 2026-08-03 | Player Overview K: FG-distance scoring DNA, FG%/XP accuracy, outdoors/indoors splits, stadium roof map, temp mocks |
| 2026-08-03 | Player Overview K: XPA on projection/production; scoring legend squares; Weekly Finish legend + series tooltips |
| 2026-08-03 | Player Overview: replace vs-leaders with sortable vs-roster fantasy compare table (RB mock mates; deltas vs viewed) |
| 2026-08-03 | Player Overview DEF: solo-tackle tiles, forced scoring DNA (sack/TKL/INT/FF/TD), Points Allowed radar + weekly PA line |
| 2026-08-03 | Player Overview: disable mocks; load real `player_scores` (default previous season when current has no weeks); season select under tabs |
| 2026-08-04 | Player Overview extras from live data: opportunity share, weekly finishes, positional SOS, roster compare, multi-year |
| 2026-08-04 | Player Overview SOS: percentile Easy/Avg/Hard (~25/50/25); preseason=prior, Wk1–4 blend, Wk5+=YTD; bye weeks excluded from sample |
| 2026-08-04 | Player Overview SOS buckets: team logo badges with matchup/rank/pts-allowed tooltips |
| 2026-08-04 | Player Overview “Without QB1” toggle (RB/WR/TE/K): depth-chart starter when live, else most pass-att weeks; recount from QB-absent games |
| 2026-08-04 | Without QB1: rush share / targets / YPC / catch rate recompute from without-QB1 weeks |
| 2026-08-04 | Without QB1 toggle on all RB/WR/TE/K with a team QB1 (disabled at 0g) |
| 2026-08-04 | Without QB1: resolve season QB1 via shared offense snaps (not current nfl_team tag) |
| 2026-08-04 | Without QB1: live/preseason falls back to depth-chart QB1 (toggle shows, 0g disabled) |
| 2026-08-04 | Season Production: per-game averages on counting tiles; accents use pace not raw totals |
| 2026-08-04 | Identity card always pins projections, bye, and position rank to the NFL current season |
| 2026-08-04 | Overview charts/stats capped to league championship week (no W18 when season ends at 17) |
| 2026-08-04 | SoS allowed/G uses top scorer vs DEF each week (not position sum / committee mean) |
| 2026-08-04 | Team DEF SoS uses opponent NFL points scored (opp PPG; higher = harder) |
| 2026-08-04 | Team DEF SoS buckets by offense rank: 1–8 Hard · 9–23 Average · 24–32 Easy |
| 2026-08-04 | Kicker SoS like DEF bands but inverted: 1–8 Easy (most K FPts allowed) · 24–32 Hard |
| 2026-08-04 | SoS schedule summary headline (Typically easy/average/difficult schedule) |
| 2026-08-04 | League Power Rankings tab (muscle icon in mobile select) + team ranking cards (scaffold scores) |
| 2026-08-04 | Power Rankings mode select: Draft Rankings · Week X · Rest of Season |
| 2026-08-04 | Team Stats secondary tab: Roster Evaluation (scaffold empty) |
| 2026-08-04 | Roster Evaluation: 4 cards (Position Strength, Starting Lineup, Positional/Starter Rankings) + mode select |
| 2026-08-04 | Starting Lineup / Starter Rankings: league-relative 1..N slot ranks (depth pools, flex-eligible, settings bars, rank tones) |
| 2026-08-04 | Roster Evaluation: current lineup chart, optimal starter rankings, positional avg ranks vs league |
| 2026-08-04 | Position Strength radar: starters vs bench league ranks per position |
| 2026-08-04 | League player profiles at `/league/[id]/players/[playerId]` keep sidebar with Players active |
| 2026-08-04 | DEF PA radar brackets: 0–7 · 8–10 · 11–14 · 15–21 · 22+ (NFL points conceded) |
| 2026-08-05 | Draft grades: one-time popup after draft complete (badge assets, projected record, playoff/champ odds, best/worst ADP) |
| 2026-08-05 | NFL Scores includes preseason fixtures in the week filter (ESPN seasontype 1) |
| 2026-08-05 | Player Overview PPG: Production, Breakdown, and roster subject use weekly mean (not re-scored season bag) |
| 2026-08-06 | Activity feed: draft picks and commissioner pick reverts |
| 2026-08-06 | Backfill script `pnpm db:backfill:draft-activity` mirrors existing draft_picks into activity |
| 2026-08-06 | Draft Rankings (Power Rankings) use live draft-grade scores from picks + season projections |
