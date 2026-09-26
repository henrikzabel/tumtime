import "server-only";

import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { clubForms, clubMembers, clubs } from "@/db/schema";

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
