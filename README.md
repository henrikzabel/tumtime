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
npm run dev            # http://localhost:3000
```

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

## Legal

- Footer and top banner state that the project is unofficial and not affiliated with TUM.
- `/imprint` and `/privacy` are placeholders to be filled in by the operator.
- Only aggregated statistics are stored and shown; no personal data.
