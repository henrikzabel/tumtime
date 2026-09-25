import "./load-env";

import { EXAM_SOURCES, type ExamSource } from "@/lib/stats/exam-record";
import { db, pgClient } from "@/db";
import { removeSource } from "@/importers/store";
import { printSummary } from "./print-summary";

async function main() {
  const source = process.argv[2] as ExamSource | undefined;
  if (!source || !EXAM_SOURCES.includes(source)) {
    console.error(`Usage: npm run remove-source -- <${EXAM_SOURCES.join("|")}>`);
    process.exitCode = 1;
    return;
  }
  const summary = await removeSource(db, source);
  console.log(`Removed ${summary.removed} records of source "${source}".`);
  printSummary({ ...summary, removed: undefined });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
