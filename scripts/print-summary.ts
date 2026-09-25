type Summary = {
  saved?: number;
  removed?: number;
  duplicatesInBatch?: string[];
  modulesRebuilt: number;
  exams: { published: number; conflict: number; hidden: number };
  conflicts: { key: string; reasons: string[] }[];
};

export function printSummary(s: Summary) {
  if (s.saved !== undefined) console.log(`Saved ${s.saved} source records.`);
  if (s.removed) console.log(`Removed ${s.removed} stale source records.`);
  if (s.duplicatesInBatch?.length) {
    console.warn(`${s.duplicatesInBatch.length} duplicate keys in this batch (last one kept):`);
    for (const k of s.duplicatesInBatch) console.warn(`  ${k}`);
  }
  console.log(
    `Rebuilt ${s.modulesRebuilt} modules: ${s.exams.published} published, ${s.exams.conflict} in conflict, ${s.exams.hidden} hidden.`,
  );
  for (const c of s.conflicts) console.warn(`  conflict ${c.key}: ${c.reasons.join("; ")}`);
}
