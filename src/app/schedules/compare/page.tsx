import type { Metadata } from "next";
import Link from "next/link";

import { ScheduleView } from "@/components/schedule/schedule-view";
import { UrlSelect } from "@/components/url-select";
import { requireUser } from "@/lib/auth/session";
import { listSchedules } from "@/lib/planning/queries";
import { getScheduleData } from "@/lib/schedule/queries";
import { formatSemesterShort, type Semester } from "@/lib/stats/semester";

export const metadata: Metadata = { title: "Compare schedules", robots: { index: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CompareSchedulesPage({ searchParams }: PageProps<"/schedules/compare">) {
  const user = await requireUser("/schedules/compare");
  const sp = await searchParams;
  const schedules = await listSchedules(user.id);
  const options = [
    { value: "", label: "Choose a schedule…" },
    ...schedules.map((s) => ({ value: s.id, label: `${s.name} (${formatSemesterShort(s.semester as Semester)})` })),
  ];
  const picked = [one(sp.a), one(sp.b)].map((id) => schedules.find((s) => s.id === id) ?? null);
  const data = await Promise.all(picked.map((s) => (s ? getScheduleData(s.semester, s.moduleCodes) : null)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/schedules" className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← My schedules
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Compare schedules</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {(["a", "b"] as const).map((param, i) => (
          <section key={param} className="min-w-0 space-y-3">
            <UrlSelect name={param} label={i === 0 ? "Left" : "Right"} options={options} value={picked[i]?.id} />
            {picked[i] && data[i] ? (
              <>
                <Link href={`/schedules/${picked[i].id}`} className="text-lg font-semibold hover:underline">
                  {picked[i].name}
                </Link>
                <ScheduleView compact entries={data[i].entries} courses={data[i].courses} selection={picked[i].selection} />
              </>
            ) : (
              <p className="rounded-lg bg-muted/60 p-8 text-center text-sm text-muted-foreground">Pick a schedule to compare.</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
