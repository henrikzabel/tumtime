import "./load-env";

import { parseArgs } from "node:util";

import { fetchText } from "@/importers/planner/http";
import { galleryUrl, parseGalleryPage, type GalleryClub } from "@/importers/clubs/gallery";
import type { ImportedClub } from "@/importers/clubs/store";

/** Load all pages of the gallery, optionally filtered by campus. */
async function loadAll(location?: string): Promise<{ clubs: GalleryClub[]; locations: string[] }> {
  const first = parseGalleryPage(await fetchText(galleryUrl(1, location), { delayMs: 800 }));
  const clubs = [...first.clubs];
  for (let page = 2; page <= first.lastPage; page++) {
    clubs.push(...parseGalleryPage(await fetchText(galleryUrl(page, location), { delayMs: 800 })).clubs);
  }
  return { clubs, locations: first.locations };
}

async function main() {
  const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });

  const all = await loadAll();
  console.log(`Gallery: ${all.clubs.length} clubs, campuses: ${all.locations.join(", ")}`);
  const byName = new Map<string, ImportedClub>();
  for (const c of all.clubs) byName.set(c.name, { ...c, locations: [] });

  for (const location of all.locations) {
    const { clubs } = await loadAll(location);
    for (const c of clubs) byName.get(c.name)?.locations.push(location);
    console.log(`  ${location}: ${clubs.length}`);
  }

  const list = [...byName.values()];
  if (values["dry-run"]) {
    console.log("Dry run — database not modified.");
    return;
  }
  const { db, pgClient } = await import("@/db");
  const { saveGalleryClubs } = await import("@/importers/clubs/store");
  try {
    const res = await saveGalleryClubs(db, list);
    console.log(`Saved ${res.total} clubs (${res.created} new, ${res.unlisted} no longer listed).`);
  } finally {
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
