import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { LABELS } from "@/lib/planner/labels";
import {
  computeProgress,
  semesterCredits,
  termLabel,
  termOf,
} from "@/lib/planner/plan";
import { getProgram } from "@/lib/planner/queries";
import { getSharedDegreePlan } from "@/lib/planning/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shared degree plan",
  robots: { index: false },
};

export default async function SharedPlanPage({
  params,
}: PageProps<"/share/plan/[token]">) {
  const plan = await getSharedDegreePlan((await params).token);
  if (!plan) notFound();
  const data = await getProgram(plan.state.program);
  const studyPlan =
    data?.plans.find((p) => p.id === plan.state.studyPlanId) ?? data?.plans[0];
  const progress = studyPlan ? computeProgress(plan.state, studyPlan) : null;
  const numbers = Object.keys(plan.state.semesters)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-[100rem]">
        <p className="text-xs/relaxed text-muted-foreground">
          Shared degree plan
          {data ? ` · ${data.program.degree} ${data.program.nameEn}` : ""} ·
          from {termLabel(plan.state.startSemester, 1)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
        {progress && (
          <p className="mt-1 text-sm text-muted-foreground">
            {progress.totalCredits} ECTS planned ·{" "}
            {progress.requiredModules.planned}/{progress.requiredModules.total}{" "}
            required modules
          </p>
        )}
        <div className="mt-6 flex gap-3 overflow-x-auto pb-3">
          {numbers.map((n) => {
            const items = plan.state.semesters[n] ?? [];
            const term = termOf(plan.state.startSemester, n);
            return (
              <section
                key={n}
                className="w-64 shrink-0 rounded-lg bg-card ring-1 ring-foreground/10"
              >
                <header className="border-b px-3 py-2">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>
                      Semester {n}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {termLabel(term, 1)}
                      </span>
                    </span>
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {semesterCredits(items)} ECTS
                    </span>
                  </div>
                  {plan.state.semesterNotes?.[n] && (
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {plan.state.semesterNotes[n]}
                    </p>
                  )}
                </header>
                <ul className="space-y-1.5 p-2">
                  {items.map((i) => (
                    <li
                      key={i.id}
                      className={cn(
                        "rounded-md p-2 text-xs/relaxed ring-1",
                        i.kind === "placeholder"
                          ? "border border-dashed border-primary/40 bg-primary/5 ring-transparent"
                          : "ring-foreground/10",
                      )}
                    >
                      {i.moduleCode ? (
                        <Link
                          href={`/catalog/${term}/${i.moduleCode}`}
                          className="hover:underline"
                        >
                          <span className="font-mono text-[0.6875rem] text-muted-foreground">
                            {i.moduleCode}
                          </span>{" "}
                          <span className="font-medium">{i.title}</span>
                        </Link>
                      ) : (
                        <span className="font-medium text-primary">
                          {i.title}
                        </span>
                      )}
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[0.6875rem] text-muted-foreground">
                        {i.credits} ECTS
                        {i.label && LABELS[i.label] && (
                          <span
                            className={cn(
                              "rounded px-1",
                              LABELS[i.label].className,
                            )}
                          >
                            {LABELS[i.label].text}
                          </span>
                        )}
                        {i.area && i.kind === "module" && (
                          <Badge variant="outline">{i.area}</Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Make your own in the{" "}
          <Link href="/degree-planner" className="text-primary hover:underline">
            degree planner
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
