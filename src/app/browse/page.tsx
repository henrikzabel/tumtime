import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { UrlSelect } from "@/components/url-select";
import { formatAverage, formatCount, formatPercent } from "@/lib/format";
import {
  BROWSE_PAGE_SIZE,
  BROWSE_SORTS,
  browseModules,
  listSchoolsWithDepartments,
  type BrowseSort,
} from "@/lib/queries";
import { formatSemesterShort, type Semester } from "@/lib/stats/semester";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Browse modules" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BrowsePage({ searchParams }: PageProps<"/browse">) {
  const sp = await searchParams;
  const school = one(sp.school);
  const department = one(sp.department);
  const typeParam = one(sp.type);
  const type = typeParam === "endterm" || typeParam === "retake" ? typeParam : undefined;
  const sortParam = one(sp.sort);
  const sort = (sortParam && sortParam in BROWSE_SORTS ? sortParam : "failure-desc") as BrowseSort;
  const page = Number(one(sp.page)) || 1;

  const [schoolList, result] = await Promise.all([
    listSchoolsWithDepartments(),
    browseModules({ school, department, type, sort, page }),
  ]);
  const selectedSchool = schoolList.find((s) => s.code === school);
  const pages = Math.max(1, Math.ceil(result.total / BROWSE_PAGE_SIZE));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const val = one(v);
      if (val && k !== "page") params.set(k, val);
    }
    if (p > 1) params.set("page", String(p));
    return `/browse?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Browse modules</h1>
      <p className="mt-1 text-muted-foreground">
        Averages and failure rates are weighted by the number of participants across all exams on record.
      </p>

      <Suspense>
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <UrlSelect
            name="school"
            label="School"
            value={school}
            resets={["department"]}
            options={[{ value: "", label: "All schools" }, ...schoolList.map((s) => ({ value: s.code, label: s.name }))]}
          />
          <UrlSelect
            name="department"
            label="Department"
            value={department}
            options={[
              { value: "", label: selectedSchool ? "All departments" : "Choose a school first" },
              ...(selectedSchool?.departments ?? []).map((d) => ({ value: d.code, label: d.name })),
            ]}
          />
          <UrlSelect
            name="type"
            label="Exam type"
            value={type}
            options={[
              { value: "", label: "Endterm + retake" },
              { value: "endterm", label: "Endterm only" },
              { value: "retake", label: "Retake only" },
            ]}
          />
          <UrlSelect
            name="sort"
            label="Sort by"
            value={sort}
            options={Object.entries(BROWSE_SORTS).map(([value, label]) => ({ value, label }))}
          />
          <span className="ml-auto pb-2 text-sm text-muted-foreground">{formatCount(result.total)} modules</span>
        </div>
      </Suspense>

      <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Module</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Department</th>
              <th className="px-4 py-2.5 text-right font-medium">Exams</th>
              <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Participants</th>
              <th className="px-4 py-2.5 text-right font-medium">Avg. grade</th>
              <th className="px-4 py-2.5 font-medium">Failure rate</th>
              <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Latest</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.code} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <Link href={`/modules/${encodeURIComponent(r.code)}`} className="group block">
                    <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                    <span className="block font-medium group-hover:text-primary group-hover:underline">
                      {r.nameEn ?? "—"}
                    </span>
                  </Link>
                </td>
                <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                  {r.department ?? "—"}
                  {r.school ? <span className="block text-xs">{r.school}</span> : null}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.examCount}</td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{formatCount(r.attempted)}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatAverage(r.averageTotal)}</td>
                <td className="px-4 py-2.5">
                  <FailureMeter value={r.failureRate} />
                </td>
                <td className="hidden px-4 py-2.5 text-right text-muted-foreground tabular-nums md:table-cell">
                  {formatSemesterShort(r.latestSemester as Semester)}
                </td>
              </tr>
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No modules match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={cn("rounded-md border px-3 py-1.5", page <= 1 && "pointer-events-none opacity-40")}
          >
            ← Previous
          </Link>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= pages}
            className={cn("rounded-md border px-3 py-1.5", page >= pages && "pointer-events-none opacity-40")}
          >
            Next →
          </Link>
        </nav>
      )}
    </div>
  );
}

function FailureMeter({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--chart-fail)_15%,transparent)]">
        <div className="h-full rounded-full bg-chart-fail" style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums">{formatPercent(value)}</span>
    </div>
  );
}
