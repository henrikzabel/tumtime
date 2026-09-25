import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";

import { GradeHistogram } from "@/components/charts/grade-histogram";
import { TrendChart, type TrendPoint } from "@/components/charts/trend-chart";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAverage, formatCount, formatDate, formatPercent } from "@/lib/format";
import { getModuleDetail, MIN_ATTEMPTS_FOR_DISTRIBUTION, type ExamWithGrades } from "@/lib/queries";
import { toDistribution } from "@/lib/stats/distribution";
import { formatSemester, formatSemesterShort, type Semester } from "@/lib/stats/semester";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

const SOURCE_LABELS: Record<string, string> = { tum_info: "TUM Info", aamin: "stats.aamin.dev", upload: "student upload" };
const TYPE_FILTERS = [
  { value: undefined, label: "All exams" },
  { value: "endterm", label: "Endterm" },
  { value: "retake", label: "Retake" },
] as const;

export async function generateMetadata({ params }: PageProps<"/modules/[code]">): Promise<Metadata> {
  const { code } = await params;
  const detail = await getModuleDetail(decodeURIComponent(code));
  if (!detail) return { title: "Module not found" };
  const name = detail.module.nameEn ?? detail.module.nameDe ?? "";
  return {
    title: `${detail.module.code} ${name}`,
    description: `Grade distributions, average grades and failure rates of ${detail.module.code} ${name} at TUM.`,
  };
}

const shortSemester = (s: string) => formatSemesterShort(s as Semester);

function trendData(exams: ExamWithGrades[], metric: "averageTotal" | "failureRate"): TrendPoint[] {
  const bySemester = new Map<string, TrendPoint & { key: number }>();
  for (const e of exams) {
    const point = bySemester.get(e.semester) ?? { label: shortSemester(e.semester), key: e.semesterKey };
    point[e.type] = e[metric];
    bySemester.set(e.semester, point);
  }
  return [...bySemester.values()].sort((a, b) => a.key - b.key);
}

export default async function ModulePage({ params, searchParams }: PageProps<"/modules/[code]">) {
  const { code } = await params;
  const { type } = await searchParams;
  const detail = await getModuleDetail(decodeURIComponent(code));
  if (!detail) notFound();

  const { module: mod, exams, formerNames } = detail;
  const typeFilter = type === "endterm" || type === "retake" ? type : undefined;
  const visible = exams.filter((e) => !typeFilter || e.type === typeFilter);
  const newestFirst = [...visible].sort((a, b) => b.semesterKey - a.semesterKey || a.type.localeCompare(b.type));
  const latestEndterm = [...exams].reverse().find((e) => e.type === "endterm") ?? exams.at(-1)!;
  const showTrends = new Set(exams.map((e) => e.semester)).size >= 2;
  const sources = [...new Set(exams.flatMap((e) => e.sources))];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/browse" className="hover:text-foreground">
          Browse
        </Link>
        {mod.schoolCode && (
          <>
            {" / "}
            <Link href={`/browse?school=${mod.schoolCode}`} className="hover:text-foreground">
              {mod.schoolName}
            </Link>
          </>
        )}
        {mod.departmentCode && (
          <>
            {" / "}
            <Link href={`/browse?school=${mod.schoolCode}&department=${mod.departmentCode}`} className="hover:text-foreground">
              {mod.departmentName}
            </Link>
          </>
        )}
      </nav>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono text-sm">
              {mod.code}
            </Badge>
            {mod.ects ? <Badge variant="outline">{mod.ects} ECTS</Badge> : null}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {mod.nameEn ?? mod.nameDe ?? mod.code}
          </h1>
          {mod.nameEn && mod.nameDe && mod.nameDe !== mod.nameEn ? (
            <p className="mt-1 text-muted-foreground">{mod.nameDe}</p>
          ) : null}
          {formerNames.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Formerly:{" "}
              {formerNames
                .map((n) => `${n.name} (${[n.firstSemester, n.lastSemester].filter(Boolean).map((s) => shortSemester(s!)).join("–")})`)
                .join(" · ")}
            </p>
          )}
        </div>
        <Link href={`/compare?m=${encodeURIComponent(mod.code)}`} className={buttonVariants({ variant: "outline" })}>
          <ArrowLeftRight /> Compare
        </Link>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Average grade"
          value={formatAverage(latestEndterm.averageTotal)}
          hint={`${latestEndterm.type === "endterm" ? "Endterm" : "Retake"} ${formatSemester(latestEndterm.semester as Semester)}`}
        />
        <StatTile label="Failure rate" value={formatPercent(latestEndterm.failureRate)} hint="of students who took the exam" />
        <StatTile label="Participants" value={formatCount(latestEndterm.attempted)} hint="attempts in that exam" />
        <StatTile label="Exams on record" value={String(exams.length)} hint={`${shortSemester(exams[0].semester)} – ${shortSemester(exams.at(-1)!.semester)}`} />
      </section>

      {showTrends && (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Average grade over time</CardTitle>
              <CardDescription>Lower is better — the axis is flipped so better years sit higher.</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={trendData(exams, "averageTotal")} metric="grade" domain={[1, 5]} reversed />
            </CardContent>
          </Card>
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Failure rate over time</CardTitle>
              <CardDescription>Share of participants who failed.</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={trendData(exams, "failureRate")} metric="percent" domain={[0, 1]} />
            </CardContent>
          </Card>
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Exams</h2>
          <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 text-sm">
            {TYPE_FILTERS.map((f) => (
              <Link
                key={f.label}
                href={f.value ? `?type=${f.value}` : "?"}
                scroll={false}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  typeFilter === f.value ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {newestFirst.length === 0 ? (
          <p className="mt-6 text-muted-foreground">No {typeFilter} exams on record.</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {newestFirst.map((e) => (
              <ExamCard key={e.id} exam={e} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        Sources: {sources.map((s) => SOURCE_LABELS[s] ?? s).join(", ")}. Aggregated statistics only. Distributions of exams
        with fewer than {MIN_ATTEMPTS_FOR_DISTRIBUTION} participants are hidden.
      </p>
    </div>
  );
}

function ExamCard({ exam: e }: { exam: ExamWithGrades }) {
  const bins = toDistribution(e.grades);
  const date = formatDate(e.date);
  const figures = [
    { label: "Average", value: formatAverage(e.averageTotal) },
    { label: "Avg. passed", value: formatAverage(e.averagePassed) },
    { label: "Failure rate", value: formatPercent(e.failureRate) },
    { label: "Participants", value: formatCount(e.attempted) },
  ];
  const extras = [
    e.registered !== null ? `${formatCount(e.registered)} registered` : null,
    e.noShow ? `${formatCount(e.noShow)} no-shows` : null,
    e.withdrawn ? `${formatCount(e.withdrawn)} withdrew` : null,
    e.cheating ? `${formatCount(e.cheating)} cheating` : null,
  ].filter(Boolean);

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{formatSemester(e.semester as Semester)}</CardTitle>
          <Badge variant={e.type === "endterm" ? "secondary" : "outline"}>{e.type === "endterm" ? "Endterm" : "Retake"}</Badge>
        </div>
        {date || extras.length ? (
          <CardDescription>{[date, ...extras].filter(Boolean).join(" · ")}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-4 gap-2">
          {figures.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="font-semibold tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
        {bins.length ? (
          <GradeHistogram bins={bins} />
        ) : (
          <p className="rounded-lg bg-muted/60 px-3 py-6 text-center text-sm text-muted-foreground">
            {(e.attempted ?? 0) < MIN_ATTEMPTS_FOR_DISTRIBUTION
              ? "Distribution hidden for small exams."
              : "No grade distribution available."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
