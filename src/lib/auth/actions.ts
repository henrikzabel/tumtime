"use server";

import { and, count, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { loginTokens, users } from "@/db/schema";
import { appUrl, sendEmail } from "@/lib/email";

import { createSession, destroySession } from "./session";
import {
  adminEmails,
  allowedDomains,
  generateToken,
  hashToken,
  isAllowedEmail,
  LOGIN_TOKEN_TTL_MINUTES,
  MAX_LINKS_PER_HOUR,
  normalizeEmail,
  safeRedirect,
} from "./tokens";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

export async function requestLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const next = safeRedirect(String(formData.get("next") ?? ""));
  if (!isAllowedEmail(email, allowedDomains())) {
    return { status: "error", email, message: "Please use your TUM e-mail address (…@tum.de or …@mytum.de)." };
  }

  const [recent] = await db
    .select({ n: count() })
    .from(loginTokens)
    .where(and(eq(loginTokens.email, email), gt(loginTokens.createdAt, new Date(Date.now() - 3600_000))));
  if ((recent?.n ?? 0) >= MAX_LINKS_PER_HOUR) {
    return { status: "error", email, message: "Too many login links requested. Please try again in an hour." };
  }

  const token = generateToken();
  await db.insert(loginTokens).values({
    tokenHash: hashToken(token),
    email,
    redirectTo: next,
    expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MINUTES * 60_000),
  });
  const link = `${appUrl()}/auth/confirm?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Your TUM Time login link",
    text: `Hi,\n\nclick the link below to sign in to TUM Time. It is valid for ${LOGIN_TOKEN_TTL_MINUTES} minutes and can be used once.\n\n${link}\n\nIf you didn't request this, you can ignore this e-mail.\n\n— TUM Time (unofficial student project, not affiliated with TUM)`,
  });
  return { status: "sent", email };
}

export type ConfirmState = { error?: string };

export async function confirmLogin(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "This login link is invalid." };

  const [row] = await db
    .update(loginTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(loginTokens.tokenHash, hashToken(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, new Date())))
    .returning();
  if (!row) return { error: "This login link has expired or was already used. Please request a new one." };

  const role = adminEmails().has(row.email) ? "admin" : "student";
  const [user] = await db
    .insert(users)
    .values({ email: row.email, role, lastLoginAt: new Date() })
    .onConflictDoUpdate({ target: users.email, set: { lastLoginAt: new Date(), role } })
    .returning({ id: users.id });
  await createSession(user.id);
  redirect(safeRedirect(row.redirectTo));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
