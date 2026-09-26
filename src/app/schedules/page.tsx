import { CalendarDays, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { planningSemester } from "@/importers/planner/match";
import { requireUser } from "@/lib/auth/session";
import { getCatalogSemesters } from "@/lib/catalog/queries";
import { createScheduleFromForm } from "@/lib/planning/actions";
import { listSchedules } from "@/lib/planning/queries";
import { formatSemester, parseSemester, semesterKey, type Semester } from "@/lib/stats/semester";

export const metadata: Metadata = { title: "Scheduler" };

export default async function SchedulesPage() {
  const user = await requireUser("/schedules");
  const [schedules, semesters] = await Promise.all([listSchedules(user.id), getCatalogSemesters()]);
  const preferred = semesters.includes(planningSemester()) ? planningSemester() : semesters[0];
  const bySemester = new Map<string, typeof schedules>();
  for (const s of schedules) bySemester.set(s.semester, [...(bySemester.get(s.semester) ?? []), s]);
  const groups = [...bySemester.entries()].sort((a, b) => semesterKey(b[0] as Semester) - semesterKey(a[0] as Semester));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Scheduler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build weekly schedules from lectures and tutorial groups, let TUM Time generate clash-free combinations, compare
            them and export to your calendar.
          </p>
        </div>
        {schedules.length >= 2 && (
          <Link href="/schedules/compare" className="text-sm font-medium text-primary hover:underline">
            Compare schedules →
          </Link>
        )}
      </header>

      <Card size="sm" className="mt-6">
        <CardContent>
          <form action={createScheduleFromForm} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-xs/relaxed font-medium">
              Name
              <Input name="name" placeholder="e.g. Plan A" maxLength={60} />
            </label>
            <label className="flex flex-col gap-1 text-xs/relaxed font-medium">
              Semester
              <select
                name="semester"
                defaultValue={preferred}
                className="h-8 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {semesters.map((s) => (
                  <option key={s} value={s}>
                    {formatSemester(s)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" size="lg">
              <Plus /> New schedule
            </Button>
          </form>
        </CardContent>
      </Card>

      {schedules.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No schedules yet. Create one above or use “Add to schedule” in the{" "}
          <Link href="/catalog" className="text-primary hover:underline">
            catalog
          </Link>
          .
        </p>
      ) : (
        groups.map(([semester, list]) => (
          <section key={semester} className="mt-8">
            <h2 className="text-sm font-semibold text-muted-foreground">{formatSemester(parseSemester(semester)!)}</h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <Link key={s.id} href={`/schedules/${s.id}`} className="group">
                  <Card size="sm" className="h-full transition-shadow group-hover:ring-primary/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-primary" />
                        {s.name}
                      </CardTitle>
                      <CardDescription>
                        {s.moduleCodes.length} {s.moduleCodes.length === 1 ? "entry" : "entries"} · updated{" "}
                        {s.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        {s.shareToken ? " · shared" : ""}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
