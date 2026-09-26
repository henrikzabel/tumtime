import type { Metadata } from "next";
import Link from "next/link";

import { PeriodForm } from "@/components/clubs/period-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { listPeriods } from "@/lib/clubs/info-session-queries";
import { addDays, formatRange, PERIOD_STATUSES, weekStart } from "@/lib/clubs/info-sessions";

export const metadata: Metadata = { title: "Info session weeks", robots: { index: false } };

export default async function InfoSessionPeriodsPage() {
  await requireAdmin("/admin/info-sessions");
  const periods = await listPeriods();
  // Suggest the two weeks starting next Monday.
  const monday = addDays(weekStart(new Date().toISOString().slice(0, 10)), 7);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/admin" className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← Admin
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Info session weeks</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        A central period (e.g. two weeks, every evening) where all clubs present themselves. Clubs request slots with their
        preferences, you auto-schedule them without topic clashes, adjust by hand and publish the weekly plan.
      </p>
      <div className="mt-6 space-y-2">
        {periods.map((p) => (
          <Link
            key={p.id}
            href={`/admin/info-sessions/${p.id}`}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 ring-1 ring-foreground/10 hover:bg-muted/50"
          >
            <span>
              <span className="block text-sm font-medium">{p.title}</span>
              <span className="text-[0.6875rem] text-muted-foreground">{formatRange(p.startsOn, p.endsOn)}</span>
            </span>
            <Badge variant={p.status === "published" ? "default" : "outline"}>{PERIOD_STATUSES[p.status]}</Badge>
          </Link>
        ))}
      </div>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>New period</CardTitle>
          <CardDescription>You can change everything later. New periods start as drafts.</CardDescription>
        </CardHeader>
        <CardContent>
          <PeriodForm
            id={null}
            initial={{
              title: "Club Info Weeks",
              description: "",
              startsOn: monday,
              endsOn: addDays(monday, 11),
              weekdays: [1, 2, 3, 4],
              slots: "18:00-18:45\n19:00-19:45\n20:00-20:45",
              venues: "Room 1 | Garching | 150\nRoom 2 | Garching | 150\nRoom 3 | München | 200",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
