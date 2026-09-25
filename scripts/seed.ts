import "./load-env";

import { sql } from "drizzle-orm";

import { db, pgClient } from "@/db";
import { departments, schools } from "@/db/schema";
import { seedSchools } from "@/db/seed-data";

async function main() {
  for (const s of seedSchools) {
    const [school] = await db
      .insert(schools)
      .values({ code: s.code, nameEn: s.nameEn, nameDe: s.nameDe })
      .onConflictDoUpdate({ target: schools.code, set: { nameEn: s.nameEn, nameDe: s.nameDe ?? null } })
      .returning();
    for (const d of s.departments) {
      await db
        .insert(departments)
        .values({ ...d, schoolId: school.id })
        .onConflictDoUpdate({
          target: departments.code,
          set: {
            schoolId: school.id,
            nameEn: d.nameEn,
            nameDe: d.nameDe ?? null,
            modulePrefixes: sql`excluded.module_prefixes`,
          },
        });
    }
  }
  console.log(`Seeded ${seedSchools.length} schools.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
