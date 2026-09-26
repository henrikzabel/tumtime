import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { applications, bookmarks, clubClaims, clubForms, clubMembers, clubs, degreePlans, schedules, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

/** GDPR Art. 15/20: everything we store about the signed-in user, as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [account] = await db.select().from(users).where(eq(users.id, user.id));
  const [apps, memberships, claims, savedBookmarks, savedSchedules, savedPlans] = await Promise.all([
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
    db.select({ module: bookmarks.moduleCode, createdAt: bookmarks.createdAt }).from(bookmarks).where(eq(bookmarks.userId, user.id)),
    db
      .select({
        name: schedules.name,
        semester: schedules.semester,
        modules: schedules.moduleCodes,
        selection: schedules.selection,
        shared: schedules.shareToken,
        createdAt: schedules.createdAt,
        updatedAt: schedules.updatedAt,
      })
      .from(schedules)
      .where(eq(schedules.userId, user.id)),
    db
      .select({ name: degreePlans.name, plan: degreePlans.state, shared: degreePlans.shareToken, createdAt: degreePlans.createdAt, updatedAt: degreePlans.updatedAt })
      .from(degreePlans)
      .where(eq(degreePlans.userId, user.id)),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    account: { email: account.email, name: account.name, role: account.role, createdAt: account.createdAt, lastLoginAt: account.lastLoginAt },
    applications: apps,
    clubMemberships: memberships,
    clubClaims: claims,
    bookmarks: savedBookmarks,
    schedules: savedSchedules.map((s) => ({ ...s, shared: !!s.shared })),
    degreePlans: savedPlans.map((p) => ({ ...p, shared: !!p.shared })),
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tumtime-my-data.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
