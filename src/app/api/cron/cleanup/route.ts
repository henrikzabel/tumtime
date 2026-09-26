import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { purgeExpiredData } from "@/lib/retention";

/** Daily retention job (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await purgeExpiredData(db);
  return NextResponse.json({ ok: true, deleted: result });
}
