import type { Metadata } from "next";
import { Suspense } from "react";

import { TimetableApp } from "@/components/planner/timetable-app";
import { planningSemester } from "@/importers/planner/match";
import { getPlannerModuleInfos, getTimetableCourses } from "@/lib/planner/queries";
import { parseSemester } from "@/lib/stats/semester";

export const metadata: Metadata = { title: "Timetable" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TimetablePage({ searchParams }: PageProps<"/timetable">) {
  const sp = await searchParams;
  const semester = parseSemester(one(sp.semester) ?? "") ?? planningSemester();
  const codes = (one(sp.modules) ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2,5}\d[A-Z0-9_-]*$/.test(c))
    .slice(0, 20);
  const [courses, infos] = await Promise.all([getTimetableCourses(semester, codes), getPlannerModuleInfos(codes)]);

  return (
    <Suspense>
      <TimetableApp
        semester={semester}
        modules={codes.map((code) => ({ code, name: infos.find((i) => i.code === code)?.nameEn ?? code }))}
        courses={courses}
      />
    </Suspense>
  );
}
