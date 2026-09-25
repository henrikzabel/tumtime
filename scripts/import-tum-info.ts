import "./load-env";

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { TUM_INFO_URL, parseTumInfo } from "@/importers/tum-info";
import { printSummary } from "./print-summary";

const USAGE = `Import exam statistics from the TUM Info API.

Usage: npm run import:tum-info -- [--file courses.json] [--url URL] [--dry-run] [--no-replace]

  --file        read a local courses.json instead of downloading it
  --url         download from this URL (default: ${TUM_INFO_URL})
  --dry-run     parse and report, but do not touch the database
  --no-replace  keep TUM Info records that are missing from this payload
                (by default the payload is treated as a full snapshot)`;

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      url: { type: "string", default: TUM_INFO_URL },
      "dry-run": { type: "boolean", default: false },
      "no-replace": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) return console.log(USAGE);

  let payload: unknown;
  if (values.file) {
    payload = JSON.parse(await readFile(values.file, "utf8"));
  } else {
    const res = await fetch(values.url!);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    payload = await res.json();
  }

  const { records, issues } = parseTumInfo(payload);
  console.log(`Parsed ${records.length} exam records (${issues.length} skipped).`);
  for (const issue of issues) console.warn(`  skipped #${issue.index} ${issue.key ?? ""}: ${issue.message}`);

  if (values["dry-run"]) {
    console.log("Dry run — database not modified.");
    return;
  }

  const { db, pgClient } = await import("@/db");
  const { saveSourceRecords } = await import("@/importers/store");
  try {
    const summary = await saveSourceRecords(db, "tum_info", records, { replaceAll: !values["no-replace"] });
    printSummary(summary);
  } finally {
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
