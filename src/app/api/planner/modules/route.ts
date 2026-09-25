import { NextResponse, type NextRequest } from "next/server";

import { getPlannerModuleInfos } from "@/lib/planner/queries";

/** GET /api/planner/modules?codes=IN0001,IN0015 — card data for modules added in the planner. */
export async function GET(request: NextRequest) {
  const codes = (request.nextUrl.searchParams.get("codes") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^[A-Za-z]{2,5}\d[A-Za-z0-9_-]*$/.test(c));
  const infos = await getPlannerModuleInfos(codes);
  return NextResponse.json(infos, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
