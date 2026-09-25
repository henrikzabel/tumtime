import type { Metadata } from "next";

import { CompareView, type CompareSeries } from "@/components/compare-view";
import { parseCompareParam } from "@/lib/compare";
import { getModuleDetail } from "@/lib/queries";
import { computeStats } from "@/lib/stats/grades";
import { formatSemesterShort, type Semester } from "@/lib/stats/semester";

export const metadata: Metadata = { title: "Compare" };

const examLabel = (semester: string, type: string) =>
  `${formatSemesterShort(semester as Semester)} · ${type === "endterm" ? "Endterm" : "Retake"}`;

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const { m } = await searchParams;
  const items = parseCompareParam(Array.isArray(m) ? m[0] : m);

  const series: CompareSeries[] = [];
  for (const item of items) {
    const detail = await getModuleDetail(item.code);
    if (!detail) continue;
    const graded = detail.exams.filter((e) => Object.keys(e.grades).length > 0);
    const options = [
      { value: "all", label: "All exams combined" },
      ...[...graded].reverse().map((e) => ({ value: `${e.semester}-${e.type}`, label: examLabel(e.semester, e.type) })),
    ];

    let grades: Record<string, number> = {};
    let selector = item.selector;
    let label: string;
    if (selector === "all") {
      for (const e of graded) for (const [g, n] of Object.entries(e.grades)) grades[g] = (grades[g] ?? 0) + n;
      label = "All exams combined";
    } else {
      const exam =
        graded.find((e) => `${e.semester}-${e.type}` === selector) ??
        [...graded].reverse().find((e) => e.type === "endterm") ??
        graded.at(-1);
      if (!exam) continue;
      selector = `${exam.semester}-${exam.type}`;
      grades = exam.grades;
      label = examLabel(exam.semester, exam.type);
    }

    const stats = computeStats(grades);
    series.push({
      code: detail.module.code,
      name: detail.module.nameEn ?? detail.module.nameDe ?? detail.module.code,
      selector,
      label,
      options,
      grades,
      attempted: stats.attempted,
      averageTotal: stats.averageTotal,
      failureRate: stats.failureRate,
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Compare</h1>
      <p className="mt-1 text-muted-foreground">
        Overlay the grade distributions of up to four modules or semesters. Shares are in percent of participants, so
        exams of different size are comparable.
      </p>
      <CompareView series={series} />
    </div>
  );
}
