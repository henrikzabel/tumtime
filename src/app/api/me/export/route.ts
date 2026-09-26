import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { applications, clubClaims, clubForms, clubMembers, clubs, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

/** GDPR Art. 15/20: everything we store about the signed-in user, as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [account] = await db.select().from(users).where(eq(users.id, user.id));
  const [apps, memberships, claims] = await Promise.all([
    db
      .select({
        club: clubs.name,
        form: clubForms.title,
        questions: clubForms.fields,
        name: applications.applicantName,
        email: applications.applicantEmail,
        answers: applications.answers,
        status: applications.status,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .innerJoin(clubs, eq(clubs.id, applications.clubId))
      .innerJoin(clubForms, eq(clubForms.id, applications.formId))
      .where(eq(applications.userId, user.id)),
    db
      .select({ club: clubs.name, role: clubMembers.role, since: clubMembers.createdAt })
      .from(clubMembers)
      .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
      .where(eq(clubMembers.userId, user.id)),
    db
      .select({ club: clubs.name, position: clubClaims.position, message: clubClaims.message, status: clubClaims.status, createdAt: clubClaims.createdAt })
      .from(clubClaims)
      .innerJoin(clubs, eq(clubs.id, clubClaims.clubId))
      .where(eq(clubClaims.userId, user.id)),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    account: { email: account.email, name: account.name, role: account.role, createdAt: account.createdAt, lastLoginAt: account.lastLoginAt },
    applications: apps,
    clubMemberships: memberships,
    clubClaims: claims,
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tumtime-my-data.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
