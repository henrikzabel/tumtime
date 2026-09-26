import "server-only";

import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";

import { generateToken, hashToken, SESSION_TTL_DAYS } from "./tokens";

export const SESSION_COOKIE = "tumtime_session";

export type CurrentUser = { id: string; email: string; name: string | null; role: "student" | "admin" };

/** The signed-in user of this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.idHash, hashToken(raw)), gt(sessions.expiresAt, new Date())));
  return row ? { ...row, role: row.role === "admin" ? "admin" : "student" } : null;
});

/** Require a signed-in user; otherwise redirect to the login page (and back afterwards). */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireAdmin(returnTo = "/admin"): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (user.role !== "admin") redirect("/me");
  return user;
}

export async function createSession(userId: string) {
  const id = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  await db.insert(sessions).values({ idHash: hashToken(id), userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) await db.delete(sessions).where(eq(sessions.idHash, hashToken(raw)));
  store.delete(SESSION_COOKIE);
}
