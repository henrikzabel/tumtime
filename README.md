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
docker compose up -d   # local Postgres 16 on :5433 (avoids clashing with a local Postgres)
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

## Importing data

### TUM Info API

```bash
npm run import:tum-info -- --dry-run          # download + parse, report problems, no DB writes
npm run import:tum-info                       # import (payload = full snapshot of the source)
npm run import:tum-info -- --file courses.json   # import a local copy
```

Records are tagged with source `tum_info`. Special grade codes in that dataset are mapped as
`6.0` → no-show, `7.0` → `B` (passed), `8.0` → `N` (failed); these mappings were checked against
the dataset's own totals and failure rates.

### Removing a source

```bash
npm run remove-source -- tum_info   # deletes all its records and re-merges affected modules
```

### Merge rules

Exams are identified by (module number, semester, type). When several sources report the same
exam, their grade distributions must match exactly (or, without a distribution, their attempt
counts). If they differ, the exam is marked `conflict` and not published until an admin pins a
source. Priority for filling in fields: `upload` > `aamin` > `tum_info`.

## Study planner & timetable (Phase 2)

`/planner` lets students start from the recommended study plan of their program, move modules
between semesters, fill elective slots and track requirements (required modules, electives,
Überfachliche Grundlagen, Anwendungsfach). Plans are stored in the browser (`localStorage`) and
can be shared as a link. `/timetable` shows lectures and tutorial groups of the chosen modules on
a weekly grid with clash detection and `.ics` export.

```bash
npm run import:planner                          # study plans, module handbook, courses of the upcoming semester
npm run import:planner -- --semester 2027SS     # courses/dates of another semester
npm run import:planner -- --skip-courses        # only study plans + module handbook
```

Sources (public, no login): the TUM School of CIT "Studienplan" pages (one table per starting
cohort) and the TUM NAT API (`api.srv.nat.tum.de`: module handbook entries, courses with groups,
dates and rooms). The importer is rate-limited; the NAT API can be slow for large modules, so a
full run takes 10–20 minutes. Supported programs are configured in
`src/importers/planner/programs.ts` (currently B.Sc. Informatik and B.Sc. Wirtschaftsinformatik).

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
| `npm test` | Run the Vitest suite (parsers, importers). Set `TEST_DATABASE_URL` to an empty scratch database to also run the DB integration tests |
| `npm run db:generate` | Generate a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Upsert schools and departments |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run import:tum-info` | Import TUM Info statistics (see below) |
| `npm run remove-source -- <source>` | Delete all data of one source |
| `npm run import:planner` | Import study plans, module handbook and course dates (see above) |

## Legal

- Footer and top banner state that the project is unofficial and not affiliated with TUM.
- `/imprint` and `/privacy` are placeholders to be filled in by the operator.
- Only aggregated statistics are stored and shown; no personal data.
