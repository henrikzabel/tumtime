import "./load-env";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db, pgClient } from "@/db";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
