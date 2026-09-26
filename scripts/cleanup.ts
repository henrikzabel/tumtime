import "./load-env";

import { db, pgClient } from "@/db";
import { purgeExpiredData } from "@/lib/retention";

purgeExpiredData(db)
  .then((r) => console.log("Deleted:", r))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
