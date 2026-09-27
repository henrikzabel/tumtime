import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="mx-auto max-w-5xl px-4 py-8 lg:mx-0 lg:px-10 lg:py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Scheduler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build weekly schedules from lectures and tutorial groups, let TUM Time generate clash-free combinations, compare
            them and export to your calendar.
          </p>
        </div>
        {schedules.length >= 2 && (
          <Link href="/schedules/compare" className="shrink-0 text-sm font-medium whitespace-nowrap text-primary hover:underline">
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
                className="h-9 rounded-[10px] border border-input bg-background shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:border-foreground/25 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15"
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
            <ul className="mt-2 divide-y overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
              {list.map((s) => (
                <li key={s.id}>
                  <Link href={`/schedules/${s.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.name}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">
                          <CalendarDays /> {s.moduleCodes.length} {s.moduleCodes.length === 1 ? "entry" : "entries"}
                        </Badge>
                        {s.shareToken ? <Badge variant="outline">Shared</Badge> : null}
                        <span className="text-xs text-muted-foreground">
                          Updated {s.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
