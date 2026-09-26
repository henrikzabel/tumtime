import { BookOpen, CalendarDays, ChartColumn } from "lucide-react";

import { getCatalogIndex } from "@/lib/catalog/queries";
import { COURSE_KEY_PREFIX } from "@/lib/catalog/entries";
import { formatSemester, parseSemester } from "@/lib/stats/semester";

export default async function CatalogHome({ params }: PageProps<"/catalog/[semester]">) {
  const semester = parseSemester((await params).semester)!;
  const entries = await getCatalogIndex(semester);
  const modules = entries.filter((e) => !e.key.startsWith(COURSE_KEY_PREFIX)).length;
  const withGrades = entries.filter((e) => e.avg !== null).length;

  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{formatSemester(semester)}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {modules.toLocaleString("en")} modules and {(entries.length - modules).toLocaleString("en")} further courses.
          Select one to see its description, lecture and tutorial times and grade statistics.
        </p>
        <ul className="mx-auto mt-6 flex w-fit flex-col gap-2 text-left text-sm">
          <li className="flex items-center gap-2.5">
            <BookOpen className="size-4 shrink-0 text-primary" />
            Module handbook descriptions
          </li>
          <li className="flex items-center gap-2.5">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            Weekly dates and rooms
          </li>
          {withGrades > 0 && (
            <li className="flex items-center gap-2.5">
              <ChartColumn className="size-4 shrink-0 text-primary" />
              Grade statistics for {withGrades.toLocaleString("en")} {withGrades === 1 ? "module" : "modules"}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
