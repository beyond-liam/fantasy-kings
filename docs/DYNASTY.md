# Dynasty leagues

Canonical product + implementation spec for dynasty format.
Update this file when dynasty decisions change. Cross-link from [`PROJECT_SPEC.md`](PROJECT_SPEC.md).

**Status:** D0–D2 shipped (settings + manager Keepers tab). D3+ not started.

---

## 1. Goals

- Support **redraft** and **dynasty** as league types chosen at create time.
- Dynasty managers **keep** a capped set of players between seasons, draft the rest, and **trade future draft picks**.
- Redraft leagues must **not** see dynasty settings, tabs, or flows.

---

## 2. Locked product decisions

| Topic | Decision |
|---|---|
| Format choice | At **create league** only (`redraft` \| `dynasty`). No mid-life conversion. |
| Year 1 draft | Full roster fill; draft order **randomized** when league is full (same as redraft). |
| Year 2+ draft | Rounds = spare roster spots after keepers; order = **reverse prior-season finish** using league **tiebreakers**. |
| Season advance | Commissioner clicks **Start new season** (alert + button on **league home**). |
| Carry into new season | Rostered **keepers** only. |
| FAAB | **Reset** each new season. |
| Waiver order (new season) | Seeded from **new draft order**. |
| Finish order | Prior season standings/finish **must persist** — drives next draft order and future-pick slot resolution. |
| Keepers max | Required setting. Managers may keep **fewer**, including **0** (empty roster → full draft of spare spots). |
| Keepers min | **Optional** setting (default off / null). |
| Keeper deadline | Optional. Timezone **Europe/London**. At deadline → **auto clear non-keepers** (no commissioner required). |
| After clear / lock | Keepers **frozen** until **draft completes**. |
| After draft completes | Keeper window **opens immediately** for the next cycle. |
| Missed deadline | Keep **0** for that team. |
| IR / Taxi vs cap | Any rostered player may be marked keeper. Whether IR / Taxi **consume** the keeper max is controlled by toggles (`irCountsTowardKeepers`, `taxiCountsTowardKeepers`). If a toggle is off, that slot type does **not** count against the max (can still be kept). |
| Draft rounds | Commissioner-configurable; **≤** spare capacity from keeper settings (e.g. roster 25, keepers max 20 → max **5** rounds). Actual team spare spots may be higher if they kept fewer. |
| Draft pool | Setting: **rookies only** \| **all available players**. |
| Draft start | **Auto clear non-keepers** if not already cleared. |
| Future picks | Asset inventory per team/year/round; rolling horizon from dynasty setting. |
| Pick display (unresolved) | e.g. `2028 1st (via Lions)` until prior season finish locks slot → e.g. `1.04`. |
| Traded future pick slot | A pick for draft year **Y** resolves from the **original team’s finish in season Y−1**. |
| Pick trading | Allowed per normal **trade settings / deadline** (not a separate dynasty-only gate). |
| Commish edit roster | Allowed **any time** (dynasty leagues). |
| Activity | Log keeper sets, clear non-keepers, commish roster edits, pick trades. |
| Email | Stay within locked Brevo set (draft + trade). No new dynasty-only email types required for v1. |

---

## 3. Settings

### 3.1 League type (create wizard)

Already present: `league_seasons.league_type` + wizard radio (**Redraft** / **Dynasty**).

Dynasty create must persist dynasty defaults (see §3.2) into season settings.

### 3.2 Dynasty rules (Rules / settings — dynasty only)

Surface under league settings (Rules-adjacent). Fields:

| Setting | Type | Notes |
|---|---|---|
| `keepersMax` | int ≥ 0 or null | Hard ceiling on **counting** keepers (see IR/Taxi toggles). Null = not set (empty in settings). Capped by roster spots (± IR/Taxi when those count). |
| `keepersMin` | int \| null | Optional; when set, `0 ≤ min ≤ max`. |
| `keeperDeadlineAt` | timestamptz \| null | Interpreted / displayed in **Europe/London**. |
| `irCountsTowardKeepers` | boolean | Default **false**. |
| `taxiCountsTowardKeepers` | boolean | Default **false**. |
| `futurePickTradeYears` | int ≥ 1 | How many **future** draft years beyond the upcoming draft can be owned/traded (rolling). |
| `draftPlayerPool` | `rookies` \| `all` | Who is eligible when the dynasty draft runs. |

**Counting keepers toward max**

- Always count keepers in **starter + bench** slots.
- Count IR keepers only if `irCountsTowardKeepers`.
- Count Taxi keepers only if `taxiCountsTowardKeepers`.
- Validation: `countingKeepers ≤ keepersMax` (and ≥ `keepersMin` when set).

**Draft rounds cap (configure draft)**

```
maxDraftRounds = rosterCap − keepersMax
```

where `rosterCap` is the league’s max active roster size used for draft math today (starters + bench; IR/taxi excluded from cap — same as current `getDraftRounds` / max roster helpers), **unless** product later ties rounds to counting keepers. Initial ship: rounds max = `rosterCap − keepersMax`. Commissioner may set fewer rounds, not more.

### 3.3 Configure draft (dynasty)

In addition to existing draft settings (style snake/linear, clock, etc.):

- **Number of rounds** — constrained as above.
- **Player pool** — rookies only vs all (may live here and/or dynasty rules; single source of truth in settings).
- On **draft start**: clear non-keepers if clearance has not run.

Redraft continues to derive rounds from full roster size (no keeper subtraction).

---

## 4. Season lifecycle

### 4.1 Year 1 (new dynasty league)

1. Create with `league_type = dynasty`.
2. Recruit / claim teams.
3. When full: **randomize draft order** (existing redraft behavior).
4. **Startup draft** fills rosters (rounds = full roster capacity).
5. Season plays; standings/finish order recorded.
6. After draft completes: keeper UI available.
7. When commissioner is ready: **Start new season** (see §4.2).

### 4.2 Start new season (commissioner)

**Entry:** League home **alert** + **Start new season** button (commissioner only), shown when the current season is in a completed / rollable state (champion crowned or equivalent “season over” gate — implement against existing season status).

**Effects (atomic where possible):**

1. Create next `league_seasons` row (or advance season number per existing multi-season patterns).
2. Carry **keepers** onto new season rosters; non-keepers already cleared or dropped.
3. **Reset FAAB** to league starting budget.
4. Set **waiver order** from the **new draft order** (reverse finish of the season just ended, with tiebreakers).
5. Persist **finish / draft order** inputs for the upcoming draft.
6. **Mint** future draft pick assets for each team for years within `futurePickTradeYears` (create DB rows for tradable picks that do not yet exist). Roll the window forward each season.
7. Open configure-draft / recruiting-or-pre-draft state as appropriate.

**Mint** = insert (or ensure) `draft_pick_assets` rows so picks appear on team pages and in trade UI.

### 4.3 Clearance / lock

Triggers (any one):

- Keeper **deadline** reached (UK) → cron or process-on-load clears non-keepers.
- Commissioner **Clear non-keepers**.
- **Draft start**.

After clearance: keepers locked until draft **completes**. Then managers may set keepers again.

---

## 5. Keepers UX

### 5.1 Manager — Team → Keepers tab (dynasty only)

- Tab on My Team (alongside Roster, Settings, etc.).
- Roster list with **checkboxes**; header shows **`N` Set / `M` Allowed** (counting rules §3.2).
- Floating **Save / Reset** (match existing dirty-bar patterns).
- Enforce max / optional min on save.
- Disabled when locked (post-clearance, pre-draft-complete).

### 5.2 Commissioner — Rosters tab (dynasty only)

New settings/commish **Rosters** area (dynasty only):

| Action | Flow |
|---|---|
| **Set keepers** | Dialog: pick a team (radio list: name + owner) → page with roster checkboxes + Set / Allowed → save. Notify / activity that commish set keepers for another team. |
| **Edit rosters** | Dialog: pick team → page to **remove** (trash icon) and **add** (player search). Keep UI consistent with app patterns. |
| **Clear non-keepers** | Confirm dialog listing each team + non-keeper players + counts → **Clear Non-Keepers**. |

### 5.3 Data model (keepers)

Prefer a clear flag on roster membership for the season, e.g. `roster_players.is_keeper` (or equivalent), rather than a parallel table — unless multi-season carry requires a dedicated keepers snapshot at clearance. Clearance drops or releases non-keepers to FA; keepers remain rostered.

---

## 6. Future draft picks

### 6.1 Assets

Each tradable pick is an asset:

- `league_id` / season context as needed
- `draft_year` (NFL/fantasy year of the draft)
- `round`
- `original_team_id` (whose finish resolves the slot)
- `owner_team_id` (current holder)
- Optional resolved `slot` / `overall` once prior season is final

Unique on `(league, draft_year, round, original_team)` (or equivalent).

### 6.2 Team Draft Picks tab (dynasty)

Replace/extend today’s “players you drafted” list for dynasty:

- Breakdown by **year** (filter years within minted horizon).
- Show unresolved labels (`2027 1st (via X)`) and resolved slots when known.
- Affordance to **trade** (deep-link or open composer with pick preselected).

Redraft can keep the current “historical draft results” panel.

### 6.3 Draft order (year 2+)

1. Rank teams by **prior season finish** (league tiebreakers).
2. **Reverse** for draft order (1st place picks last).
3. Snake/linear per draft style setting.

---

## 7. Trading picks

### 7.1 Composer

On propose-trade UI, per team:

- Tabs: **Roster** \| **Picks**
- Picks table: selectable future assets owned by that team (within trade-years horizon / ownership).

Validation:

- Existing trade rules (deadline, vetoes, roster capacity after player moves, etc.).
- Pick transfers update `owner_team_id` only; `original_team_id` unchanged.
- Roster minimums / IR taxi rules still apply to player legs.

### 7.2 Activity / notifications

- Pick-inclusive trades use existing trade activity + trade emails where applicable.
- Dedicated activity copy should mention picks (e.g. “Lions traded 2028 1st (via Lions) …”).

---

## 8. Redraft isolation

When `league_type !== dynasty`:

- Hide dynasty rules settings, Rosters keepers/edit/clear, Keepers team tab, future-pick trade UI, draft rounds-from-keepers, Start new season dynasty alert (unless a future redraft multi-season path is specified separately — **out of scope** here).
- Server actions must **reject** dynasty mutations on redraft leagues.

---

## 9. Activity events (v1)

Log at least:

- Keeper selections saved (manager or commissioner-for-team)
- Non-keepers cleared (deadline / commish / draft start)
- Commissioner roster add/remove
- Start new season
- Existing trade events including picks

---

## 10. Implementation phases

Ship in small increments; stop for approval after each.

| Phase | Deliverable |
|---|---|
| **D0** | ✅ Settings shape + zod + create defaults (`lib/leagues/dynasty-settings.ts`) |
| **D1** | ✅ Dynasty rules settings UI + persistence; redraft isolation |
| **D2** | ✅ Keeper flag + manager Keepers tab + validation (max/min/IR/Taxi counting) |
| **D3** | Commish Set keepers + Clear non-keepers (+ activity) |
| **D4** | Keeper deadline (UK) + auto-clear job/path |
| **D5** | Configure draft: rounds cap + pool; clear on draft start |
| **D6** | `draft_pick_assets` + mint on Start new season; league home alert |
| **D7** | Team future picks UI (year filter, unresolved labels) |
| **D8** | Trade composer Roster \| Picks + execute pick transfers |
| **D9** | Commish Edit rosters |

Do not start D6–D8 until D2–D5 clearance rules are stable.

---

## 11. Explicitly out of dynasty v1

- Converting redraft → dynasty
- Conditional picks
- Draft lottery (use reverse standings + tiebreakers only)
- Separate pick-only trade deadline
- Dynasty-specific email beyond existing trade/draft set
- Friends / public dynasty discovery

---

## 12. Open implementation notes (non-blocking)

- Exact season status that enables **Start new season** (align with champion crowning / `completed`).
- Whether historical “players drafted” remains a sub-view under Draft Picks for dynasty.
- Cron vs page-load for keeper deadline (prefer shared process helper + cron like trades/waivers).

Ask before changing locked decisions in §2.
