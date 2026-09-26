/**
 * Incremental sync of the full TUMonline course catalog of one semester. The list endpoint is
 * cheap (100 courses per request) and carries each course's last-modified time; the detail
 * endpoint (groups, dates, modules) costs one request per course. Only new or changed courses
 * are fetched again, and courses that disappeared from the list are removed.
 */
export type CatalogListItem = { course_id: number; modified_tumonline?: string | null };

export type SyncPlan = { fetch: number[]; remove: number[]; unchanged: number };

export function planCatalogSync(
  list: CatalogListItem[],
  stored: Map<number, number | null>,
  { force = false }: { force?: boolean } = {},
): SyncPlan {
  const listed = new Set<number>();
  const fetch: number[] = [];
  let unchanged = 0;
  for (const item of list) {
    if (listed.has(item.course_id)) continue;
    listed.add(item.course_id);
    const modified = item.modified_tumonline ? Date.parse(item.modified_tumonline) : NaN;
    const have = stored.get(item.course_id);
    const upToDate = !force && have !== undefined && have !== null && Number.isFinite(modified) && have >= modified;
    if (upToDate) unchanged++;
    else fetch.push(item.course_id);
  }
  const remove = [...stored.keys()].filter((id) => !listed.has(id));
  return { fetch, remove, unchanged };
}
