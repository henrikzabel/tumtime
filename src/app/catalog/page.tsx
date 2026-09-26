import { redirect } from "next/navigation";

import { getCatalogSemesters } from "@/lib/catalog/queries";
import { planningSemester } from "@/importers/planner/match";

export const revalidate = 3600;

export default async function CatalogIndex() {
  const semesters = await getCatalogSemesters();
  const preferred = planningSemester();
  redirect(`/catalog/${semesters.includes(preferred) ? preferred : (semesters[0] ?? preferred)}`);
}
