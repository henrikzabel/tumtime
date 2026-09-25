import { NextResponse, type NextRequest } from "next/server";

import { searchModules } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const hits = await searchModules(q);
  return NextResponse.json(hits, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
