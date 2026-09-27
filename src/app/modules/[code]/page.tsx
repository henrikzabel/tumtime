import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";

import { ModuleGrades } from "@/components/module-grades";
import { ModuleReviews } from "@/components/reviews/module-reviews";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import { getModuleDetail } from "@/lib/queries";
import { getModuleReviewSummary } from "@/lib/reviews/reviews";
import { formatSemesterShort, type Semester } from "@/lib/stats/semester";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/modules/[code]">): Promise<Metadata> {
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

export default async function ModulePage({
  params,
  searchParams,
}: PageProps<"/modules/[code]">) {
  const { code } = await params;
  const { type, rsem } = await searchParams;
  const detail = await getModuleDetail(decodeURIComponent(code));
  if (!detail) notFound();

  const { module: mod, exams, formerNames } = detail;
  const reviewSemester = typeof rsem === "string" && /^\d{4}(WS|SS)$/.test(rsem) ? rsem : undefined;
  const reviews = await getModuleReviewSummary(db, mod.id, reviewSemester);
  const query = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
    return q.size ? `?${q}` : "?";
  };
  const typeParam = typeof type === "string" ? type : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/browse" className="hover:text-foreground">
          Browse
        </Link>
        {mod.schoolCode && (
          <>
            {" / "}
            <Link
              href={`/browse?school=${mod.schoolCode}`}
              className="hover:text-foreground"
            >
              {mod.schoolName}
            </Link>
          </>
        )}
        {mod.departmentCode && (
          <>
            {" / "}
            <Link
              href={`/browse?school=${mod.schoolCode}&department=${mod.departmentCode}`}
              className="hover:text-foreground"
            >
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
                .map(
                  (n) =>
                    `${n.name} (${[n.firstSemester, n.lastSemester]
                      .filter(Boolean)
                      .map((s) => shortSemester(s!))
                      .join("–")})`,
                )
                .join(" · ")}
            </p>
          )}
        </div>
        <Link
          href={`/compare?m=${encodeURIComponent(mod.code)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <ArrowLeftRight /> Compare
        </Link>
      </header>

      <div className="mt-8">
        <ModuleGrades
          exams={exams}
          type={type}
          filterHref={(t) => query({ type: t, rsem: reviewSemester })}
        />
      </div>

      <ModuleReviews
        code={mod.code}
        summary={reviews}
        semester={reviewSemester}
        filterHref={(s) => `${query({ type: typeParam, rsem: s })}#reviews-heading`}
      />
    </div>
  );
}
