# Cron and Score Sync Ops Runbook

Operations guide for cron jobs and the score sync pipeline during beta game weeks.

## Environment Variables

Configure these in Vercel (never commit values to git):

- **`CRON_SECRET`** — Required. Bearer token for all cron endpoints. Returns 503 if unset, 401 if wrong/missing.
- **`DATABASE_URL`** — Postgres connection string (Supabase).
- **`BREVO_API_KEY`**, **`BREVO_FROM_EMAIL`**, **`BREVO_FROM_NAME`** — For draft reminders and other transactional alerts.

## Cron Endpoints

All routes accept `Authorization: Bearer $CRON_SECRET` or `x-cron-secret: $CRON_SECRET` header.

### `/api/cron/sync-scores` (GET or POST)

Syncs player scores from Sleeper, ESPN boxscores, and nflverse. Finalizes matchups when scores update.

**Runtime:** `maxDuration: 60` (Sleeper + ESPN + nflverse fetch can be slow).

**Query params:**
- `week` (optional) — NFL calendar week 1–18 (ESPN numbering). Defaults to current week.
- `season` (optional) — Four-digit year (e.g., `2024`). Defaults to current season.
- `projections=1` — Include projected stats (default off).
- `espn=0` — Skip ESPN boxscore merge (default on for live/final games).
- `nflverse=1` — Force nflverse official stats even during live games (default: auto after slate completes; auto skipped in preseason).
- `nflverse=0` — Skip nflverse official stats entirely.

**Preseason:** Sync follows Sleeper `season_type=pre` and ESPN’s current preseason window (same as NFL Scores). Hall of Fame is ESPN week 1; Preseason Week 1 is ESPN week 2. Rows are stored with `season_type=pre`.

**Expected response (200):**
```json
{
  "ok": true,
  "season": "2024",
  "week": 1,
  "upserted": 1234,
  "skipped": false,
  "espn": { "upserted": 456, "skipped": false },
  "nflverse": { "upserted": 789, "skipped": false },
  "finalize": { "checked": 10, "finalized": 2 }
}
```

**Failure modes:**
- **401** — Missing or wrong `CRON_SECRET`.
- **503** — `CRON_SECRET` not configured in Vercel.
- **500** — Score sync failed (check logs for details).
- **finalize skipped** — When `upserted === 0`, finalize step is skipped. This can happen if scoreboard data is empty (see plan 005 for outage gates).
- **nflverse empty board** — If ESPN scoreboard fetch fails, nflverse may not run even when games are complete (addressed by plan 005).

**Manual trigger:**
```bash
curl -X POST "https://<your-app>/api/cron/sync-scores" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Force nflverse for completed week:**
```bash
curl -X POST "https://<your-app>/api/cron/sync-scores?nflverse=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### `/api/cron/process-waivers` (GET or POST)

Processes all due waivers. Run hourly.

**Expected response (200):**
```json
{
  "ok": true,
  "checked": 5,
  "processed": 2,
  "results": [...]
}
```

**Manual trigger:**
```bash
curl -X POST "https://<your-app>/api/cron/process-waivers" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### `/api/cron/process-trades` (GET or POST)

Processes all ready trades. Run hourly.

**Expected response (200):**
```json
{
  "ok": true,
  "checked": 3,
  "processed": 1,
  "results": [...]
}
```

**Manual trigger:**
```bash
curl -X POST "https://<your-app>/api/cron/process-trades" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### `/api/cron/start-drafts` (GET or POST)

Auto-starts drafts that are due. Run every 1–5 minutes near draft windows.

**Expected response (200):**
```json
{
  "ok": true,
  "checked": 2,
  "started": 1
}
```

**Manual trigger:**
```bash
curl -X POST "https://<your-app>/api/cron/start-drafts" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### `/api/cron/process-draft-picks` (GET or POST)

Autopicks live draft seats that are due: claimed teams with Autopick + a queue
pick immediately; **expired clocks always queue→BPA** (claimed or open).
Also applies timed-email daily pause windows (auto-pause / auto-resume).
This is the authoritative unattended path — draft start/pick/queue/autopick
toggle and the draft room also kick the same drain when someone is in the app.

Run every **1–5 minutes** while any draft is live or in email/slow mode with a pick clock (Vercel Hobby daily is only a backup). A **67ms HTTP error** is usually **401** (missing `Authorization: Bearer $CRON_SECRET`); an **Inactive** job will not fire.

**Expected response (200):**
```json
{
  "ok": true,
  "checked": 2,
  "picked": 1,
  "skipped": 1,
  "errors": []
}
```

**Manual trigger:**
```bash
curl -X POST "https://<your-app>/api/cron/process-draft-picks" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### `/api/cron/draft-reminders` (GET or POST)

Sends T-24h and “starts soon” reminders for **live and email** drafts.
Run every 5 minutes (Vercel Hobby only supports daily cron).

- **T-24h:** draft start is 23–25 hours from now
- **Starts soon:** draft start is within the next **20 minutes** (until start). Dedupe keys include `draftStartAt`, so rescheduling allows a new send.

**Expected response (200):**
```json
{
  "ok": true,
  "checked24h": 3,
  "sent24h": 6,
  "checked15m": 1,
  "sent15m": 2
}
```

`checked*` counts seasons in each reminder window; `sent*` counts emails successfully handed to Brevo.

**Manual trigger:**
```bash
curl -X POST "https://<your-app>/api/cron/draft-reminders" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## cron-job.org Scheduling

Recommended schedule for game days (all times UTC):

| Route | Schedule | Notes |
|-------|----------|-------|
| `sync-scores` | Every 15 minutes on game days | Start 30 minutes before first kickoff, stop 30 minutes after last game ends. |
| `process-waivers` | Every hour | Run overnight Tuesday/Wednesday when waivers clear. |
| `process-trades` | Every hour | Can run 24/7 or gate to business hours. |
| `start-drafts` | Every 1–5 minutes | Only during draft season; narrow to draft windows if possible. |
| `process-draft-picks` | Every 1–5 minutes | While drafts are live / on a pick clock. Critical for 6h+ email drafts. |
| `draft-reminders` | Every 5 minutes | Only during draft season. |

**Game day example (Sunday):**
- First kickoff: 6:00 PM UTC (1 PM ET)
- Last game ends: ~11:30 PM UTC (6:30 PM ET)
- Run `sync-scores` every 15 minutes from 5:30 PM UTC to midnight UTC.

**Force nflverse after slate:**
Once all games are final (typically Monday morning), manually trigger with `nflverse=1` to replace Sleeper/ESPN with official stats:
```bash
curl -X POST "https://<your-app>/api/cron/sync-scores?nflverse=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Pre-Season Checklist

Before Week 1:

1. **Verify `CRON_SECRET` is set in Vercel** — Check project settings → Environment Variables.
2. **Test each cron endpoint manually** — Use curl with `Authorization: Bearer $CRON_SECRET`. Should return 200, not 401 or 503.
3. **Configure cron-job.org schedules** — Add jobs for game days pointing to production URLs.
4. **Verify score sync finalize gate** — Ensure plan 004 (finalize playoff weeks) is complete. Without it, playoff matchups may not finalize.
5. **Verify scoreboard outage gates** — Ensure plan 005 (harden scoreboard outage gates) is complete. Without it, empty ESPN scoreboards can block nflverse.
6. **Test nflverse fallback** — Manually trigger `sync-scores?nflverse=1` for a completed week to verify official stats replace Sleeper.
7. **Check Brevo API key** — Draft reminders will fail silently if `BREVO_API_KEY` is missing or invalid.

## Troubleshooting

**503 on all cron routes:**
- `CRON_SECRET` is not set in Vercel. Add it to project environment variables and redeploy.

**401 on all cron routes:**
- Wrong or missing `Authorization` header. Verify `Bearer $CRON_SECRET` matches Vercel env var.

**Finalize skipped (upserted = 0):**
- Score sync ran but no scores were upserted. Check logs for upstream API failures (Sleeper, ESPN, nflverse).
- If scoreboard data is empty (ESPN API outage), nflverse will not run. This is addressed by plan 005.

**Matchups not finalizing:**
- Verify plan 004 (finalize playoff weeks) is complete. Playoff matchups require special handling.
- Check `finalize` field in sync-scores response. If `checked > 0` but `finalized === 0`, matchups may not be due or scores are still changing.

**Draft reminders not sending:**
- Check `BREVO_API_KEY` and `BREVO_FROM_EMAIL` in Vercel (and that the sender is verified in Brevo).
- Verify cron-job.org is hitting `/api/cron/draft-reminders` every **5 minutes** — Vercel Hobby daily cron cannot hit the T-15m window.
- Same for `/api/cron/start-drafts` every 1–5 minutes near draft time (Hobby daily is not enough).
- Same for `/api/cron/process-draft-picks` every 1–5 minutes while a draft clock is running — without it, autopicks only fire when someone has the draft room open.
- Check Vercel logs for `[email] Brevo not configured` or `Brevo send failed`.
- If Brevo was misconfigured earlier, failed attempts no longer permanently burn dedupe keys (claims are released on failure). To clear old burned keys: `delete from email_sends where dedupe_key like 'draft:%';` (scoped carefully).
- Confirm managers have emails on `auth.users` (OTP login accounts do).

**nflverse not running:**
- By default, nflverse only runs after all games are complete (no live games).
- Force it with `nflverse=1` query param.
- If ESPN scoreboard fetch fails, nflverse will not run automatically (plan 005 addresses this).

## Related Plans

- **Plan 003** — Characterize score sync finalize (prerequisite for understanding finalize behavior).
- **Plan 004** — Finalize playoff weeks (prerequisite for playoff matchup finalization).
- **Plan 005** — Harden scoreboard outage gates (prerequisite for nflverse fallback when ESPN API is down).
- **Plan 006** — Lineup snapshot official corrections (uses nflverse stats for official lineup scoring).
- **Plan 007** — Trade deadline fail closed (related to process-trades cron behavior).

## Security Notes

- Never commit `CRON_SECRET` values to git. Use Vercel environment variables only.
- Rotate `CRON_SECRET` if exposed. Update Vercel env vars and cron-job.org configs.
- All cron routes are public URLs but require authentication. Do not disable `assertCronAuthorized`.
- If you discover a cron route without auth, STOP and escalate before documenting a public URL.
