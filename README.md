# Fantasy Kings

Private friend-group fantasy football app (offense-first redraft MVP). Next.js App Router, Supabase Auth + Postgres, Drizzle, shadcn/ui, Figtree.

Canonical product/tech decisions live in [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md).

## Prerequisites

- Node 20+
- **pnpm** only (do not use npm/yarn for this repo)
- A Supabase project (free tier)

## Setup

```bash
pnpm install
cp .env.example .env.local
# Fill in values in .env.local (never commit secrets)
```

### Environment variables

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| `DATABASE_URL` | **App runtime** Postgres via Supabase pooler (port `6543`, transaction mode; `?pgbouncer=true` OK) |
| `DIRECT_URL` | **Drizzle Kit only** — direct Postgres (port `5432`) for `db:migrate` / `db:push` / studio |

### Database

```bash
pnpm db:push
pnpm db:seed:positions
pnpm db:seed:players
pnpm db:seed:scores
```

Optional: `pnpm db:seed:scores:stats` for stats-mode scores.

## Develop

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Useful scripts

| Script | Purpose |
|---|---|
| `pnpm lint` | ESLint |
| `pnpm exec tsc --noEmit` | Typecheck |
| `pnpm test` | Unit tests (ownership map today; expands with Vitest later) |
| `pnpm db:studio` | Drizzle Studio |

## Stack notes

- **Fonts:** Figtree via `next/font`
- **Icons:** Hugeicons free (Stroke Rounded)
- **Auth:** magic link / OTP
- **Free tier only** — see operating rules in the project spec

## Agent / contributor guidance

See [`AGENTS.md`](AGENTS.md) and Section 2 of the project spec (smallest increments, stop for approval).
