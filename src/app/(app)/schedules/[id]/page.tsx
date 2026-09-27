import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScheduleEditor } from "@/components/schedule/schedule-editor";
import { requireUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/email";
import { getSchedule } from "@/lib/planning/queries";
import { getScheduleData } from "@/lib/schedule/queries";
import { parseSemester } from "@/lib/stats/semester";

export const metadata: Metadata = { title: "Schedule", robots: { index: false } };

export default async function SchedulePage({ params }: PageProps<"/schedules/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/schedules/${id}`);
  const schedule = await getSchedule(id, user.id);
  const semester = schedule ? parseSemester(schedule.semester) : null;
  if (!schedule || !semester) notFound();
  const { entries, courses } = await getScheduleData(semester, schedule.moduleCodes);

  return (
    <ScheduleEditor
      // Remount when the module list changes on the server, so derived state starts fresh.
      key={schedule.moduleCodes.join(",")}
      schedule={{
        id: schedule.id,
        name: schedule.name,
        semester,
        moduleCodes: schedule.moduleCodes,
        selection: schedule.selection,
        shareToken: schedule.shareToken,
      }}
      entries={entries}
      courses={courses}
      origin={appUrl()}
    />
  );
}
