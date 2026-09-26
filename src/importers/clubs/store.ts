import { and, eq, notInArray, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { clubs } from "@/db/schema";

import { slugify, type GalleryClub } from "./gallery";

export type ImportedClub = GalleryClub & { locations: string[] };

/**
 * Upsert gallery clubs by name. TUM-provided fields are refreshed; fields a club edits itself
 * (description, contact, website once changed) are never overwritten. Clubs that disappeared from
 * the gallery are marked as unlisted instead of being deleted (they may have members/applications).
 */
export async function saveGalleryClubs(db: Db, list: ImportedClub[]) {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ slug: clubs.slug, name: clubs.name }).from(clubs);
    const slugs = new Set(existing.map((c) => c.slug));
    const byName = new Map(existing.map((c) => [c.name, c.slug]));
    let created = 0;

    for (const c of list) {
      let slug = byName.get(c.name);
      if (!slug) {
        const base = slugify(c.name);
        slug = base;
        for (let i = 2; slugs.has(slug); i++) slug = `${base}-${i}`;
        slugs.add(slug);
        created++;
      }
      await tx
        .insert(clubs)
        .values({
          slug,
          name: c.name,
          sourceDescription: c.description || null,
          focusAreas: c.focusAreas,
          locations: c.locations,
          website: c.website,
          imageUrl: c.imageUrl,
          source: "tum_gallery",
          listed: true,
        })
        .onConflictDoUpdate({
          target: clubs.name,
          set: {
            sourceDescription: sql`excluded.source_description`,
            focusAreas: sql`excluded.focus_areas`,
            locations: sql`excluded.locations`,
            imageUrl: sql`excluded.image_url`,
            website: sql`coalesce(${clubs.website}, excluded.website)`,
            listed: true,
          },
        });
    }

    const names = list.map((c) => c.name);
    const unlisted = names.length
      ? await tx
          .update(clubs)
          .set({ listed: false })
          .where(and(eq(clubs.source, "tum_gallery"), eq(clubs.listed, true), notInArray(clubs.name, names)))
          .returning({ id: clubs.id })
      : [];
    return { total: list.length, created, unlisted: unlisted.length };
  });
}
