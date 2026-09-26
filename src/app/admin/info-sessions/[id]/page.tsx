import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { asc, eq } from "drizzle-orm";

import { PeriodBoard, type BoardClub } from "@/components/clubs/period-board";
import { PeriodForm } from "@/components/clubs/period-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { clubs } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { autoSchedule, deletePeriod, setPeriodStatus } from "@/lib/clubs/info-session-actions";
import { getPeriod, getPeriodRequests, getPeriodSessions } from "@/lib/clubs/info-session-queries";
import {
  cellKey,
  formatRange,
  formatSlots,
  formatVenues,
  PERIOD_STATUSES,
  periodCells,
  periodDates,
  toBerlin,
  type PeriodStatus,
} from "@/lib/clubs/info-sessions";

export const metadata: Metadata = { title: "Plan info session weeks", robots: { index: false } };

const NEXT_STATUS: Record<PeriodStatus, { status: PeriodStatus; label: string }[]> = {
  draft: [{ status: "collecting", label: "Open for club requests" }],
  collecting: [
    { status: "published", label: "Publish schedule" },
    { status: "draft", label: "Back to draft" },
  ],
  published: [{ status: "collecting", label: "Unpublish (reopen requests)" }],
};

export default async function PlanPeriodPage({ params }: PageProps<"/admin/info-sessions/[id]">) {
  const { id: raw } = await params;
  const id = Number(raw);
  await requireAdmin(`/admin/info-sessions/${raw}`);
  const period = await getPeriod(id);
  if (!period) notFound();
  const [sessions, requests, allClubs] = await Promise.all([
    getPeriodSessions(id),
    getPeriodRequests(id),
    db.select({ clubId: clubs.id, name: clubs.name, focusAreas: clubs.focusAreas }).from(clubs).where(eq(clubs.listed, true)).orderBy(asc(clubs.name)),
  ]);

  const placed: Record<string, number> = {};
  for (const s of sessions) {
    const { date, time } = toBerlin(s.startsAt);
    placed[cellKey(date, time, s.venue ?? "")] = s.clubId;
  }
  const boardClubs = new Map<number, BoardClub>();
  for (const r of requests) boardClubs.set(r.clubId, { clubId: r.clubId, name: r.clubName, focusAreas: r.focusAreas, preferredDates: r.preferredDates, avoidDates: r.avoidDates, preferredTimes: r.preferredTimes, requested: true });
  for (const s of sessions) {
    if (!boardClubs.has(s.clubId)) {
      boardClubs.set(s.clubId, { clubId: s.clubId, name: s.clubName, focusAreas: s.focusAreas, preferredDates: [], avoidDates: [], preferredTimes: [], requested: false });
    }
  }
  const capacity = periodCells(period).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link href="/admin/info-sessions" className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← Info session weeks
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{period.title}</h1>
        <Badge variant={period.status === "published" ? "default" : "outline"}>{PERIOD_STATUSES[period.status]}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatRange(period.startsOn, period.endsOn)} · {periodDates(period).length} evenings × {period.slots.length} slots ×{" "}
        {period.venues.length} rooms = <strong>{capacity}</strong> sessions · {requests.length} requests · {sessions.length} scheduled
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {NEXT_STATUS[period.status].map((n) => (
          <form key={n.status} action={setPeriodStatus}>
            <input type="hidden" name="periodId" value={id} />
            <input type="hidden" name="status" value={n.status} />
            <Button type="submit" variant={n.status === "published" ? "default" : "outline"}>
              {n.label}
            </Button>
          </form>
        ))}
        <form action={autoSchedule.bind(null, id)}>
          <input type="hidden" name="mode" value="fill" />
          <Button type="submit" variant="outline">
            <Sparkles /> Auto-schedule remaining
          </Button>
        </form>
        <form action={autoSchedule.bind(null, id)}>
          <input type="hidden" name="mode" value="replace" />
          <Button type="submit" variant="ghost">
            Re-plan everything
          </Button>
        </form>
        {period.status === "published" && (
          <Link href="/clubs/info-sessions" className="self-center text-xs/relaxed text-primary underline-offset-4 hover:underline">
            View public schedule →
          </Link>
        )}
      </div>
      {requests.length > capacity && (
        <p className="mt-2 text-xs/relaxed text-destructive">
          {requests.length} clubs asked for a slot but there are only {capacity}. Add evenings, slots or rooms.
        </p>
      )}

      <div className="mt-6">
        <PeriodBoard
          periodId={id}
          dates={periodDates(period)}
          slots={period.slots}
          venues={period.venues}
          placed={placed}
          clubs={[...boardClubs.values()]}
          otherClubs={allClubs.filter((c) => !boardClubs.has(c.clubId))}
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Requests ({requests.length})</CardTitle>
            <CardDescription>Preferences clubs sent from their dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[32rem] space-y-2 overflow-y-auto">
            {requests.map((r) => (
              <div key={r.id} className="border-b pb-2 text-xs/relaxed last:border-0">
                <Link href={`/clubs/${r.clubSlug}`} className="font-medium hover:underline">
                  {r.clubName}
                </Link>
                <div className="text-muted-foreground">
                  {[
                    r.preferredDates.length ? `prefers ${r.preferredDates.map((d) => d.slice(5)).join(", ")}` : null,
                    r.avoidDates.length ? `not ${r.avoidDates.map((d) => d.slice(5)).join(", ")}` : null,
                    r.preferredTimes.length ? `at ${r.preferredTimes.join("/")}` : null,
                    r.campus,
                    r.language?.toUpperCase(),
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No preferences"}
                </div>
                {r.notes && <p className="mt-0.5 italic">“{r.notes}”</p>}
              </div>
            ))}
            {requests.length === 0 && (
              <p className="text-xs/relaxed text-muted-foreground">
                No requests yet.{period.status === "draft" ? " Open the period for requests so clubs see it on their dashboard." : ""}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Sessions that no longer fit after a change are unscheduled.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PeriodForm
              id={id}
              initial={{
                title: period.title,
                description: period.description ?? "",
                startsOn: period.startsOn,
                endsOn: period.endsOn,
                weekdays: period.weekdays,
                slots: formatSlots(period.slots),
                venues: formatVenues(period.venues),
              }}
            />
            <form action={deletePeriod}>
              <input type="hidden" name="periodId" value={id} />
              <Button type="submit" variant="destructive" size="sm">
                Delete period and its sessions
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
