import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PlannerApp } from "@/components/planner/planner-app";
import { getPlannerModuleInfos, getProgram } from "@/lib/planner/queries";
import { planningSemester } from "@/importers/planner/match";

export async function generateMetadata({ params }: PageProps<"/planner/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProgram(slug);
  return { title: data ? `Planner · ${data.program.degree} ${data.program.nameEn}` : "Planner" };
}

export default async function ProgramPlannerPage({ params }: PageProps<"/planner/[slug]">) {
  const { slug } = await params;
  const data = await getProgram(slug);
  if (!data || data.plans.length === 0) notFound();
  const codes = data.plans.flatMap((p) => p.entries.map((e) => e.moduleCode).filter((c): c is string => !!c));
  const moduleInfos = await getPlannerModuleInfos(codes);

  return (
    <Suspense>
      <PlannerApp
        program={data.program}
        plans={data.plans}
        initialModuleInfos={moduleInfos}
        planningSemester={planningSemester()}
      />
    </Suspense>
  );
}
