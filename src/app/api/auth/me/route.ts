import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";

/** Lightweight endpoint for the header's account menu (keeps pages statically renderable). */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(user ? { email: user.email, role: user.role } : null, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
