import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DegreePlanner } from "@/components/degree/degree-planner";
import { planningSemester } from "@/importers/planner/match";
import { requireUser } from "@/lib/auth/session";
import { getCatalogIndex, getCatalogSemesters } from "@/lib/catalog/queries";
import { appUrl } from "@/lib/email";
import { getPlannerModuleInfos, getProgram } from "@/lib/planner/queries";
import { getBookmarkCodes, getDegreePlan } from "@/lib/planning/queries";

export const metadata: Metadata = {
  title: "Degree plan",
  robots: { index: false },
};

export default async function DegreePlanPage({
  params,
}: PageProps<"/degree-planner/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/degree-planner/${id}`);
  const plan = await getDegreePlan(id, user.id);
  if (!plan) notFound();
  const data = await getProgram(plan.state.program);
  if (!data || data.plans.length === 0) notFound();

  const planCodes = Object.values(plan.state.semesters)
    .flat()
    .map((i) => i.moduleCode)
    .filter((c): c is string => !!c);
  const recommended = data.plans.flatMap((p) =>
    p.entries.map((e) => e.moduleCode).filter((c): c is string => !!c),
  );
  const [infos, semesters, bookmarkCodes] = await Promise.all([
    getPlannerModuleInfos([...planCodes, ...recommended]),
    getCatalogSemesters(),
    getBookmarkCodes(user.id),
  ]);
  const index = semesters[0] ? await getCatalogIndex(semesters[0]) : [];
  const moduleBookmarks = bookmarkCodes.filter((c) => !c.startsWith("C_"));
  const bookmarkInfos = await getPlannerModuleInfos(moduleBookmarks);

  return (
    <DegreePlanner
      plan={{
        id: plan.id,
        name: plan.name,
        state: plan.state,
        shareToken: plan.shareToken,
      }}
      program={data.program}
      plans={data.plans}
      initialModuleInfos={infos}
      planningSemester={planningSemester()}
      schedulerSemesters={semesters}
      bookmarks={moduleBookmarks.map((code) => {
        const info = bookmarkInfos.find((i) => i.code === code);
        const entry = index.find((e) => e.key === code);
        return {
          code,
          title: info?.nameEn ?? info?.nameDe ?? entry?.title ?? code,
          ects: info?.credits ?? entry?.ects ?? null,
        };
      })}
      origin={appUrl()}
    />
  );
}
