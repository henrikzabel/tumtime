import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_FILTERS, filterCatalog } from "@/lib/catalog/entries";
import { getCatalogIndex } from "@/lib/catalog/queries";
import { parseSemester } from "@/lib/stats/semester";

/** Quick search in one semester's catalog (used by "Add a module" in the scheduler). */
export async function GET(request: NextRequest) {
  const semester = parseSemester(request.nextUrl.searchParams.get("semester") ?? "");
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  if (!semester || q.trim().length < 2) return NextResponse.json([]);
  const hits = filterCatalog(await getCatalogIndex(semester), { ...DEFAULT_FILTERS, q }).slice(0, 10);
  return NextResponse.json(
    hits.map((e) => ({ key: e.key, title: e.title, ects: e.ects, school: e.school })),
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
