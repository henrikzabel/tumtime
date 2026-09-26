# TUM Time

An unofficial platform for students at the Technical University of Munich, inspired by
[Berkeleytime](https://berkeleytime.com). **Not affiliated with TUM.**

Features, modelled on Berkeleytime:

- **Catalog** (`/catalog`): every module and course of a semester with descriptions, lecture and
  tutorial groups, weekly times, rooms and grade statistics.
- **Scheduler** (`/schedules`): weekly schedules with group pickers, clash detection, automatic
  generation of clash-free schedules, comparison, share links and `.ics` export.
- **Degree planner** (`/degree-planner`): plan all semesters from the official study plan, track
  ECTS and requirements, labels, bookmarks.
- **Grades** (`/browse`, `/compare`, `/modules/<code>`): grade distributions, averages and failure
  rates of TUM exams.
- **Clubs** (`/clubs`): directory of all student clubs with filters (time per week, language,
  audience, fee, campus), recruitment timelines, team structures, FAQs, sign-up forms and a central
  **info session schedule** (`/clubs/info-sessions`).

Schedules, degree plans and bookmarks require signing in with a TUM e-mail address. Everything is
built on the central `modules` table (study-abroad recognitions will follow).

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

## Degree planner & study plans

`/degree-planner` starts from the recommended study plan of a program (onboarding: program → first
semester), lets students move modules between semesters, fill elective slots, label modules
(completed, retake, maybe, abroad), add semester notes, drag in bookmarked modules and track
requirements (required modules, electives, Überfachliche Grundlagen, Anwendungsfach). Plans are
stored per account; a revocable link shares a read-only view. The upcoming semester can be opened
in the scheduler. Old browser-only plans are offered for import, and old `/planner` and
`/timetable` links redirect.

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

## Course catalog

`npm run import:catalog` imports **all** courses of a semester from the TUM NAT API: lectures,
tutorials and seminars with their groups, weekly dates, rooms, organisation/school and linked
modules. The first run makes one request per course (~6,000, a few hours, rate-limited); later runs
only refetch courses whose TUMonline "last modified" time changed and remove courses that
disappeared. Runs can be interrupted and resumed.

```bash
npm run import:catalog                        # upcoming semester
npm run import:catalog -- --semester 2027SS   # another semester
npm run import:catalog -- --descriptions      # also fetch missing module handbook entries
npm run import:catalog -- --limit 50          # quick partial run for development
```

## Student clubs (Phase 4)

`/clubs` is a two-pane directory like the catalog: the club list with search and filters on the
left (focus area, campus, hours per week, language, "open to", free membership, recruiting now,
upcoming info session; shareable via the URL), the selected club on the right with tabs
**Overview** (key-fact tiles, description, activities), **Join** (how to join, time commitment,
open forms, info sessions, open positions), **Team** (org chart), **FAQs**, **Projects** and
**Resources**. A horizontal **recruitment timeline** combines the club's own milestones, its info
sessions and form deadlines.

Club members can **claim** a profile (`/clubs/<slug>/claim`); an admin approves it in `/admin`.
Club managers then use `/dashboard/<slug>` to edit their profile (basics used by the filters, key
facts, activities, FAQs, projects, resources), their **team structure** (roles/teams with holders,
"looking for people" flags), their recruitment timeline and info sessions, build **custom sign-up forms**
(short/long text, e-mail, link, number, date, single/multiple choice, checkbox; draft/open/closed,
deadline) and review applications (status, internal notes, e-mail notifications, CSV export).
Students apply at `/clubs/<slug>/apply/<formId>` and follow their applications in `/me`.

### Info session weeks

A proposal for TUM and the clubs: a shared window (e.g. two weeks, Mon–Thu evenings, a few rooms in
parallel) in which every club presents itself. Admins create a period in `/admin/info-sessions`
(nights, time slots, rooms with campus/capacity) and open it for requests. Clubs send preferences
from their dashboard (preferred/blocked nights, times, campus, language). **Auto-schedule** assigns
every club one slot: blocked nights are never used, preferences and campus are respected where
possible, clubs sharing a focus area never run in parallel, and nights are evenly filled
(`src/lib/clubs/info-sessions.ts`, tested). Admins adjust on a planning board (click a club, click
a room to move/swap), then publish the weekly plan at `/clubs/info-sessions` — with filters,
"tonight", a starred personal plan (stored in the browser) and a print layout. Clubs can also add
their own sessions outside a period.

**Later (not built yet):** Apple Calendar, Google Calendar and Sonaa integrations for info
sessions and the personal plan.

```bash
npm run import:clubs     # import/refresh clubs from the TUM gallery (~30 requests, rate-limited)
npm run cleanup          # delete expired data (also runs daily via Vercel Cron: /api/cron/cleanup)
```

**Accounts:** passwordless login with one-time links, only for TUM e-mail addresses (`tum.de`,
`mytum.de` and subdomains). Tokens and session ids are stored hashed. Without `RESEND_API_KEY`,
e-mails (including login links) are printed to the server console, which is handy locally. Admins
are configured via `ADMIN_EMAILS`.

**Privacy:** applications are deleted 6 months after submission; users can withdraw applications,
download their data (`/api/me/export`) and delete their account. Answers are validated against the
club's form definition on the server; CSV exports are protected against formula injection.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | no | Enables privacy-friendly Plausible analytics for this domain |
| `APP_URL` | prod | Public base URL used in e-mail links (e.g. `https://tumtime.example`) |
| `RESEND_API_KEY` | prod | Resend API key; without it e-mails are logged to the console |
| `EMAIL_FROM` | prod | Sender, e.g. `TUM Time <noreply@tumtime.example>` (domain verified in Resend) |
| `ADMIN_EMAILS` | yes | Comma-separated admin e-mail addresses (approve club claims) |
| `ALLOWED_EMAIL_DOMAINS` | no | Login domains, default `tum.de,mytum.de` |
| `CRON_SECRET` | prod | Secret for the daily cleanup cron (Vercel sets the header automatically) |

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
| `npm run import:catalog` | Import/refresh all courses of a semester (incremental) |
| `npm run import:clubs` | Import/refresh student clubs from the TUM gallery |
| `npm run cleanup` | Delete expired applications, login links and sessions |

## Legal

- Footer and top banner state that the project is unofficial and not affiliated with TUM.
- `/imprint` and `/privacy` are placeholders to be filled in by the operator.
- Only aggregated statistics are stored and shown; no personal data.
- Club applications are personal data: consent at submission, 6-month retention, export and
  deletion in `/me`. `/privacy` contains a draft that the operator must complete.
