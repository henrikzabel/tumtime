import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ScheduleView } from "@/components/schedule/schedule-view";
import { getSharedSchedule } from "@/lib/planning/queries";
import { getScheduleData } from "@/lib/schedule/queries";
import { formatSemester, parseSemester } from "@/lib/stats/semester";

export const metadata: Metadata = { title: "Shared schedule", robots: { index: false } };

export default async function SharedSchedulePage({ params }: PageProps<"/share/schedule/[token]">) {
  const schedule = await getSharedSchedule((await params).token);
  const semester = schedule ? parseSemester(schedule.semester) : null;
  if (!schedule || !semester) notFound();
  const { entries, courses } = await getScheduleData(semester, schedule.moduleCodes);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs/relaxed text-muted-foreground">Shared schedule · {formatSemester(semester)}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{schedule.name}</h1>
      <div className="mt-6">
        <ScheduleView entries={entries} courses={courses} selection={schedule.selection} />
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Build your own in the{" "}
        <Link href="/schedules" className="text-primary hover:underline">
          scheduler
        </Link>
        .
      </p>
    </div>
  );
}
