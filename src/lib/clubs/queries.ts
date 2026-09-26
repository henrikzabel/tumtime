import "server-only";

import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { applications, clubClaims, clubForms, clubMembers, clubs, users } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/session";

/** A form accepts applications if it is open and not past its deadline. */
export const formIsOpen = and(
  eq(clubForms.status, "open"),
  or(isNull(clubForms.closesAt), gt(clubForms.closesAt, sql`now()`)),
);

export type ClubListItem = {
  slug: string;
  name: string;
  summary: string | null;
  focusAreas: string[];
  locations: string[];
  imageUrl: string | null;
  recruiting: boolean;
  claimed: boolean;
};

export async function listClubs(): Promise<ClubListItem[]> {
  const rows = await db
    .select({
      slug: clubs.slug,
      name: clubs.name,
      description: clubs.description,
      sourceDescription: clubs.sourceDescription,
      focusAreas: clubs.focusAreas,
      locations: clubs.locations,
      imageUrl: clubs.imageUrl,
      recruiting: sql<boolean>`exists (select 1 from ${clubForms} where ${clubForms.clubId} = ${clubs.id} and ${formIsOpen})`,
      claimed: sql<boolean>`exists (select 1 from ${clubMembers} where ${clubMembers.clubId} = ${clubs.id})`,
    })
    .from(clubs)
    .where(eq(clubs.listed, true))
    .orderBy(asc(clubs.name));
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    summary: firstSentences(r.description) ?? r.sourceDescription,
    focusAreas: r.focusAreas,
    locations: r.locations,
    imageUrl: r.imageUrl,
    recruiting: r.recruiting,
    claimed: r.claimed,
  }));
}

function firstSentences(text: string | null, max = 220): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export async function getClubBySlug(slug: string) {
  const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug));
  if (!club) return null;
  const [openForms, members] = await Promise.all([
    db
      .select({ id: clubForms.id, title: clubForms.title, intro: clubForms.intro, closesAt: clubForms.closesAt })
      .from(clubForms)
      .where(and(eq(clubForms.clubId, club.id), formIsOpen))
      .orderBy(desc(clubForms.createdAt)),
    db.select({ userId: clubMembers.userId, role: clubMembers.role }).from(clubMembers).where(eq(clubMembers.clubId, club.id)),
  ]);
  return { club, openForms, members };
}

// --- Club dashboard ----------------------------------------------------------------------------


/** The club if `user` may manage it (member or site admin). */
export async function getManagedClub(slug: string, user: CurrentUser) {
  const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug));
  if (!club) return null;
  if (user.role === "admin") return club;
  const [m] = await db
    .select()
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, user.id)));
  return m ? club : null;
}

export async function getClubDashboard(clubId: number) {
  const [forms, members, counts] = await Promise.all([
    db.select().from(clubForms).where(eq(clubForms.clubId, clubId)).orderBy(desc(clubForms.createdAt)),
    db
      .select({ userId: clubMembers.userId, role: clubMembers.role, email: users.email, name: users.name })
      .from(clubMembers)
      .innerJoin(users, eq(users.id, clubMembers.userId))
      .where(eq(clubMembers.clubId, clubId)),
    db
      .select({ formId: applications.formId, status: applications.status, n: sql<number>`count(*)::int` })
      .from(applications)
      .where(eq(applications.clubId, clubId))
      .groupBy(applications.formId, applications.status),
  ]);
  return { forms, members, counts };
}

export async function getClubApplications(clubId: number) {
  return db
    .select({
      id: applications.id,
      formId: applications.formId,
      formTitle: clubForms.title,
      fields: clubForms.fields,
      applicantName: applications.applicantName,
      applicantEmail: applications.applicantEmail,
      answers: applications.answers,
      status: applications.status,
      clubNote: applications.clubNote,
      createdAt: applications.createdAt,
    })
    .from(applications)
    .innerJoin(clubForms, eq(clubForms.id, applications.formId))
    .where(eq(applications.clubId, clubId))
    .orderBy(desc(applications.createdAt));
}

export async function getPendingClaims() {
  return db
    .select({
      id: clubClaims.id,
      position: clubClaims.position,
      message: clubClaims.message,
      status: clubClaims.status,
      createdAt: clubClaims.createdAt,
      clubName: clubs.name,
      clubSlug: clubs.slug,
      email: users.email,
      claimed: sql<boolean>`exists (select 1 from ${clubMembers} where ${clubMembers.clubId} = ${clubs.id})`,
    })
    .from(clubClaims)
    .innerJoin(clubs, eq(clubs.id, clubClaims.clubId))
    .innerJoin(users, eq(users.id, clubClaims.userId))
    .orderBy(sql`${clubClaims.status} = 'pending' desc`, desc(clubClaims.createdAt))
    .limit(100);
}

export async function getMyOverview(userId: string) {
  const [apps, memberships, claims] = await Promise.all([
    db
      .select({
        id: applications.id,
        status: applications.status,
        createdAt: applications.createdAt,
        statusChangedAt: applications.statusChangedAt,
        formTitle: clubForms.title,
        clubName: clubs.name,
        clubSlug: clubs.slug,
      })
      .from(applications)
      .innerJoin(clubForms, eq(clubForms.id, applications.formId))
      .innerJoin(clubs, eq(clubs.id, applications.clubId))
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.createdAt)),
    db
      .select({ name: clubs.name, slug: clubs.slug, role: clubMembers.role })
      .from(clubMembers)
      .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
      .where(eq(clubMembers.userId, userId)),
    db
      .select({ clubName: clubs.name, clubSlug: clubs.slug, status: clubClaims.status, createdAt: clubClaims.createdAt })
      .from(clubClaims)
      .innerJoin(clubs, eq(clubs.id, clubClaims.clubId))
      .where(and(eq(clubClaims.userId, userId), eq(clubClaims.status, "pending"))),
  ]);
  return { apps, memberships, claims };
}
