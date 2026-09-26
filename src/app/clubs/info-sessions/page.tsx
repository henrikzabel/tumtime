import { CalendarDays, CalendarPlus, Presentation, Route, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InfoSessionSchedule, type PublicSession } from "@/components/clubs/info-session-schedule";
import { getPeriod, getPeriodSessions, getStandaloneSessions, listPeriods, type SessionRow } from "@/lib/clubs/info-session-queries";
import { addDays, formatLongDay, formatRange, fromBerlin, periodDates, toBerlin } from "@/lib/clubs/info-sessions";

export const metadata: Metadata = {
  title: "Club info sessions",
  description: "All student club info sessions at TUM in one weekly plan — find the clubs you want to meet.",
};
export const revalidate = 300;

const toPublic = (s: SessionRow): PublicSession => ({
  id: s.id,
  clubName: s.clubName,
  clubSlug: s.clubSlug,
  tagline: s.tagline,
  focusAreas: s.focusAreas,
  date: toBerlin(s.startsAt).date,
  start: toBerlin(s.startsAt).time,
  end: toBerlin(s.endsAt).time,
  venue: s.venue,
  campus: s.campus,
  language: s.language,
  onlineUrl: s.onlineUrl,
});

export default async function InfoSessionsPage({ searchParams }: PageProps<"/clubs/info-sessions">) {
  const sp = await searchParams;
  const today = toBerlin(new Date()).date;
  const published = await listPeriods({ status: ["published"] });
  const requested = typeof sp.period === "string" ? await getPeriod(Number(sp.period)) : null;
  const period =
    (requested?.status === "published" ? requested : null) ??
    [...published].reverse().find((p) => p.endsOn >= today) ??
    published[0] ??
    null;

  const sessions = period ? (await getPeriodSessions(period.id)).map(toPublic) : [];
  const from = fromBerlin(today, "00:00");
  const others = (await getStandaloneSessions(from, fromBerlin(addDays(today, 60), "00:00"))).map(toPublic);
  const clubCount = new Set(sessions.map((s) => s.clubSlug)).size;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      <Link href="/clubs" className="text-xs/relaxed text-muted-foreground hover:text-foreground print:hidden">
        ← All clubs
      </Link>
      {period ? (
        <>
          <header className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">Info session weeks</p>
              <h1 className="text-3xl font-semibold tracking-tight">{period.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {period.description ??
                  "Every evening a few clubs present themselves in parallel — clubs with the same focus never clash, so you can meet all the ones you care about."}
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-6 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">When</dt>
                <dd className="font-semibold whitespace-nowrap">{formatRange(period.startsOn, period.endsOn)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Evenings</dt>
                <dd className="font-semibold tabular-nums">{periodDates(period).length}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Clubs</dt>
                <dd className="font-semibold tabular-nums">{clubCount}</dd>
              </div>
            </dl>
          </header>
          {published.length > 1 && (
            <nav className="mt-3 flex flex-wrap gap-2 text-xs/relaxed print:hidden" aria-label="Other periods">
              {published.map((p) => (
                <Link
                  key={p.id}
                  href={`/clubs/info-sessions?period=${p.id}`}
                  aria-current={p.id === period.id ? "page" : undefined}
                  className={p.id === period.id ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}
                >
                  {p.title}
                </Link>
              ))}
            </nav>
          )}
          <div className="mt-6">
            <InfoSessionSchedule dates={periodDates(period)} slots={period.slots} sessions={sessions} today={today} />
          </div>
        </>
      ) : (
        <header className="mt-2">
          <h1 className="text-3xl font-semibold tracking-tight">Club info sessions</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            There is no central info session schedule right now. Below are the sessions clubs announced themselves.
          </p>
        </header>
      )}

      <section className="mt-12 print:hidden">
        <h2 className="text-lg font-semibold tracking-tight">More info sessions</h2>
        <p className="text-xs/relaxed text-muted-foreground">Announced by the clubs themselves, next 60 days.</p>
        {others.length > 0 ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((s) => (
              <li key={s.id} className="flex gap-3 rounded-lg border p-3">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 text-sm">
                  <Link href={`/clubs/${s.clubSlug}`} className="font-medium hover:text-primary">
                    {s.clubName}
                  </Link>
                  <div className="text-xs/relaxed text-muted-foreground">
                    {formatLongDay(s.date)}, {s.start}–{s.end}
                  </div>
                  <div className="text-xs/relaxed text-muted-foreground">
                    {[s.venue, s.campus, s.onlineUrl ? "online" : null, s.language?.toUpperCase()].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">None announced yet.</p>
        )}
      </section>

      <section className="mt-12 rounded-lg border p-6 print:hidden">
        <h2 className="text-lg font-semibold tracking-tight">Why info session weeks?</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Today every club schedules its own info session — often on the same evenings, spread over many weeks, and hard to
          find. A shared two-week window at the start of the semester gives first-semesters one place to discover the whole
          club landscape.
        </p>
        <ul className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <Route className="mb-1 size-4 text-primary" />
            <strong>No clashes.</strong> Clubs with the same focus never present at the same time.
          </li>
          <li>
            <Users className="mb-1 size-4 text-primary" />
            <strong>Fair for clubs.</strong> Every club gets a slot; preferences and blocked nights are respected.
          </li>
          <li>
            <Presentation className="mb-1 size-4 text-primary" />
            <strong>Fewer rooms.</strong> A handful of lecture halls each evening instead of hundreds of scattered bookings.
          </li>
          <li>
            <CalendarPlus className="mb-1 size-4 text-primary" />
            <strong>Plan your weeks.</strong> Star sessions to build your own plan. Calendar sync is coming.
          </li>
        </ul>
        <p className="mt-4 text-xs/relaxed text-muted-foreground">
          Club managers request a slot from their club dashboard under “Recruitment &amp; info sessions”.
        </p>
      </section>
    </div>
  );
}
