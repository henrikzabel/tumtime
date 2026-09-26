import { GraduationCap, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ImportLocalPlans } from "@/components/degree/import-local-plans";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { BACHELOR_CREDITS, termLabel } from "@/lib/planner/plan";
import { listPrograms } from "@/lib/planner/queries";
import { listDegreePlans } from "@/lib/planning/queries";

export const metadata: Metadata = { title: "Degree planner" };

export default async function DegreePlansPage() {
  const user = await requireUser("/degree-planner");
  const [plans, programs] = await Promise.all([
    listDegreePlans(user.id),
    listPrograms(),
  ]);
  const programName = new Map(
    programs.map((p) => [p.slug, `${p.degree} ${p.nameEn}`]),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Degree planner
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Plan all semesters of your degree: start from the recommended study
            plan, move modules around, fill your electives and track your
            requirements.
          </p>
        </div>
        <Link
          href="/degree-planner/new"
          className={buttonVariants({ size: "lg" })}
        >
          <Plus /> New plan
        </Link>
      </header>

      <ImportLocalPlans hasPlans={plans.length > 0} />

      {plans.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You have no plans yet.{" "}
            <Link
              href="/degree-planner/new"
              className="text-primary hover:underline"
            >
              Create your first plan
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const credits = Object.values(p.state.semesters)
              .flat()
              .reduce((s, i) => s + i.credits, 0);
            return (
              <Link
                key={p.id}
                href={`/degree-planner/${p.id}`}
                className="group"
              >
                <Card
                  size="sm"
                  className="h-full transition-shadow group-hover:ring-primary/40"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="size-4 text-primary" /> {p.name}
                    </CardTitle>
                    <CardDescription>
                      {programName.get(p.state.program) ?? p.state.program} ·
                      from {termLabel(p.state.startSemester, 1)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, (credits / BACHELOR_CREDITS) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {credits} / {BACHELOR_CREDITS} ECTS planned
                      {p.shareToken ? " · shared" : ""}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
