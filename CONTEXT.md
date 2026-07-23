# Fantasy Kings — domain context

Shared vocabulary for product and architecture. Prefer these names over file-level jargon.

## Core

| Term | Meaning |
|---|---|
| **League** | Private fantasy competition; addressed by `publicId` in URLs |
| **League Season** | One season’s settings, roster rules, draft, and standings for a League |
| **Team** | A manager’s entry in a League Season (`userId` null = open/bot slot) |
| **Pick** | One turn in a Draft: validate eligibility, write roster, advance the board (`lib/leagues/draft/pick.ts` → `commitDraftPick`) |
| **Draft** | Live or email/slow board for a League Season (schedule, clock, autopick) |
| **Trade** | Proposal between two Teams; may enter review/veto before execute |
| **Waiver** | Claim on a free agent; adjudicated then applied on process day (`lib/leagues/waivers/process.ts` → `processSeasonWaivers`) |
| **League Alert** | Domain event fan-out: resolve recipients once, then in-app + email adapters |

## League Alert

Actions and crons **announce** domain moments (`announceTradeProposed`, `announceDraftStarted`, …). They do not call Brevo or insert notification rows directly for those moments.

- **Interface:** `deliverAlert` / `announce*` helpers in `lib/alerts/`
- **Adapters:** in-app (`createNotifications`), email (Brevo via `lib/email/*`)
- **Recipients:** `lib/alerts/recipients.ts` (season owners, team owners)

In-app-only leftovers (reject/cancel/etc.) may still use `notifyUsers` until migrated.

## Out of scope here

Auth OTP stays on Supabase. Push notifications deferred.
