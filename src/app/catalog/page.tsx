import { redirect } from "next/navigation";

import { planningSemester } from "@/importers/planner/match";
import { getCatalogSemesters } from "@/lib/catalog/queries";

/** /catalog → the upcoming semester (or the newest imported one), keeping any filters. */
export default async function CatalogIndex({ searchParams }: PageProps<"/catalog">) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  const semesters = await getCatalogSemesters();
  const preferred = planningSemester();
  const semester = semesters.includes(preferred) ? preferred : (semesters[0] ?? preferred);
  redirect(`/catalog/${semester}${qs ? `?${qs}` : ""}`);
}
