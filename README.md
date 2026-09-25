# TUM Time

An unofficial platform for students at the Technical University of Munich, inspired by
[Berkeleytime](https://berkeleytime.com). **Not affiliated with TUM.**

Phase 1 (in progress): **exam statistics**: grade distributions, averages and failure rates of TUM
exams, with search, browsing and comparison. Later phases (study planner, study-abroad recognitions,
club discovery) build on the same `modules` table.

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui-style components (`components.json` is set up for `npx shadcn add`)
- PostgreSQL (Supabase in production) with Drizzle ORM
- Recharts, Vitest, cheerio

## Setup

Requirements: Node.js ≥ 20.9, npm, and Docker (for the local database).

```bash
npm install
cp .env.example .env.local
docker compose up -d   # local Postgres 16 on :5432
npm run db:migrate     # apply migrations (incl. pg_trgm extension)
npm run db:seed        # schools + departments
npm run dev            # http://localhost:3000
```

### Production database (Supabase)

Create a project in an EU region (e.g. Frankfurt, `eu-central-1`) and sign Supabase's DPA for GDPR.
Set `DATABASE_URL` to the *transaction pooler* connection string and run `npm run db:migrate` once.

## Data model

`modules` (keyed by the stable TUM module number) is the central table that later phases also
reference. Statistics live in two layers:

- **`source_records`**: one normalised record per exam *per source* (`tum_info`, `aamin`, `upload`),
  unique on (source, module number, semester, type).
- **`exams` + `grade_counts`**: the public, merged view, rebuilt from `source_records`. If sources
  disagree, the exam is marked `conflict` and hidden until an admin pins one source. Deleting a
  source's records and re-merging removes that source completely.

`grade_counts` holds graded outcomes only (`1.0`–`5.0` incl. steps like `1.4`, `B` = passed,
`N` = failed); no-shows, withdrawals and cheating are separate columns on `exams`.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | no | Enables privacy-friendly Plausible analytics for this domain |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm test` | Run the Vitest suite (parsers, importers) |
| `npm run db:generate` | Generate a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Upsert schools and departments |
| `npm run db:studio` | Open Drizzle Studio |

## Legal

- Footer and top banner state that the project is unofficial and not affiliated with TUM.
- `/imprint` and `/privacy` are placeholders to be filled in by the operator.
- Only aggregated statistics are stored and shown; no personal data.
