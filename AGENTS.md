# Fantasy Kings — agent notes

Read [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) before implementing. Follow Section 2:

- Smallest reviewable increments
- Stop after each increment for approval
- Free tier only
- Ask on ambiguity

## Stack (locked)

Next.js App Router · pnpm · Drizzle · Supabase Auth/Postgres · shadcn/ui · Hugeicons · Figtree.

TanStack Query and Zustand are **not** installed — defer until draft room / client cache needs them.

## Verify

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Docs

Keep the project spec checklist and changelog updated when shipping features.
