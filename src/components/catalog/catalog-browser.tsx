"use client";

import { Bookmark, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ACTIVITY_GROUPS,
  CATALOG_SORTS,
  COURSE_KEY_PREFIX,
  DEFAULT_FILTERS,
  filterCatalog,
  filtersFromParams,
  filtersToParams,
  type CatalogEntry,
  type CatalogFilters,
} from "@/lib/catalog/entries";
import { formatAverage, formatPercent } from "@/lib/format";
import { formatSemester, type Semester } from "@/lib/stats/semester";
import { cn } from "@/lib/utils";

const PAGE = 120;
const DAYS = [
  [1, "Mo"],
  [2, "Tu"],
  [3, "We"],
  [4, "Th"],
  [5, "Fr"],
] as const;

const selectClass =
  "h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs/relaxed text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30";

/** Grade colour: green for good averages, amber/red for hard ones (text + tint, never colour alone). */
export function gradeTone(avg: number | null): string {
  if (avg === null) return "bg-muted text-muted-foreground";
  if (avg <= 2.0) return "bg-[#008236]/12 text-[#008236] dark:text-[#4ade80]";
  if (avg <= 2.7) return "bg-[#2a78d6]/12 text-[#2a78d6] dark:text-[#7cb6ff]";
  if (avg <= 3.3) return "bg-[#eda100]/15 text-[#8a5d00] dark:text-[#f5c451]";
  return "bg-[#e7000b]/12 text-[#c10008] dark:text-[#ff8080]";
}

export function CatalogBrowser({
  semester,
  semesters,
  entries,
  bookmarks,
  loggedIn,
}: {
  semester: Semester;
  semesters: Semester[];
  entries: CatalogEntry[];
  bookmarks: string[];
  loggedIn: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = useSelectedLayoutSegment();
  const [filters, setFilters] = useState<CatalogFilters>(() => filtersFromParams(new URLSearchParams(searchParams.toString())));
  const [limit, setLimit] = useState(PAGE);
  const [showFilters, setShowFilters] = useState(false);
  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);

  const schools = useMemo(() => [...new Set(entries.map((e) => e.school).filter((s): s is string => !!s))].sort(), [entries]);
  const languages = useMemo(() => [...new Set(entries.flatMap((e) => e.languages))].sort(), [entries]);
  const visible = useMemo(() => filterCatalog(entries, filters, bookmarkSet), [entries, filters, bookmarkSet]);
  const query = filtersToParams(filters).toString();
  const activeFilters = Object.entries(filters).filter(
    ([k, v]) => k !== "q" && k !== "sort" && JSON.stringify(v) !== JSON.stringify(DEFAULT_FILTERS[k as keyof CatalogFilters]),
  ).length;

  function update(patch: Partial<CatalogFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setLimit(PAGE);
    // Keep the URL shareable without a server round trip.
    const qs = filtersToParams(next).toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b p-3">
        <div className="flex gap-2">
          <select
            aria-label="Semester"
            className={cn(selectClass, "w-auto font-medium")}
            value={semester}
            onChange={(e) => router.push(`/catalog/${e.target.value}${query ? `?${query}` : ""}`)}
          >
            {semesters.map((s) => (
              <option key={s} value={s}>
                {formatSemester(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn(
              "ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs/relaxed transition-colors hover:bg-muted",
              activeFilters > 0 && "border-primary text-primary",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search by module number or title…"
            aria-label="Search the catalog"
            className="h-8 w-full rounded-md border border-input bg-input/20 pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 pt-1 text-xs/relaxed">
            <label className="flex flex-col gap-1 text-muted-foreground">
              School
              <select className={selectClass} value={filters.school ?? ""} onChange={(e) => update({ school: e.target.value || null })}>
                <option value="">All schools</option>
                {schools.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground">
              Type
              <select className={selectClass} value={filters.activity ?? ""} onChange={(e) => update({ activity: e.target.value || null })}>
                <option value="">All types</option>
                {ACTIVITY_GROUPS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground">
              Language
              <select className={selectClass} value={filters.language ?? ""} onChange={(e) => update({ language: e.target.value || null })}>
                <option value="">Any language</option>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l === "DE" ? "German" : l === "EN" ? "English" : l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground">
              ECTS
              <select
                className={selectClass}
                value={filters.ects}
                onChange={(e) => update({ ects: e.target.value as CatalogFilters["ects"] })}
              >
                <option value="any">Any</option>
                <option value="small">≤ 3</option>
                <option value="medium">4–6</option>
                <option value="large">&gt; 6</option>
              </select>
            </label>
            <div className="col-span-2 flex flex-col gap-1 text-muted-foreground">
              Only on these days
              <div className="flex gap-1">
                {DAYS.map(([d, label]) => {
                  const on = filters.days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update({ days: on ? filters.days.filter((x) => x !== d) : [...filters.days, d].sort() })}
                      className={cn(
                        "h-7 flex-1 rounded-md border text-xs/relaxed transition-colors",
                        on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-foreground">
              <input
                type="checkbox"
                className="size-3.5 accent-[var(--primary)]"
                checked={filters.withGrades}
                onChange={(e) => update({ withGrades: e.target.checked })}
              />
              Has grade data
            </label>
            {loggedIn && (
              <label className="flex items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  className="size-3.5 accent-[var(--primary)]"
                  checked={filters.bookmarked}
                  onChange={(e) => update({ bookmarked: e.target.checked })}
                />
                Bookmarked
              </label>
            )}
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => update({ ...DEFAULT_FILTERS, q: filters.q, sort: filters.sort })}
                className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" /> Clear filters
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs/relaxed text-muted-foreground">
          <span>
            {visible.length.toLocaleString("en")} {visible.length === 1 ? "result" : "results"}
          </span>
          <label className="flex items-center gap-1">
            Sort
            <select
              className="bg-transparent font-medium text-foreground outline-none"
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as CatalogFilters["sort"] })}
            >
              {Object.entries(CATALOG_SORTS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Catalog results">
        {visible.slice(0, limit).map((e) => {
          const active = selected !== null && decodeURIComponent(selected).toUpperCase() === e.key;
          return (
            <li key={e.key}>
              <Link
                href={`/catalog/${semester}/${e.key}${query ? `?${query}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex gap-3 border-b px-3 py-2.5 transition-colors hover:bg-muted/60",
                  active && "bg-primary/8 shadow-[inset_3px_0_0_var(--primary)]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs/relaxed text-muted-foreground">
                    <span className="font-mono font-medium text-foreground">
                      {e.key.startsWith(COURSE_KEY_PREFIX) ? "Course" : e.key}
                    </span>
                    {e.ects !== null && <span>· {e.ects} ECTS</span>}
                    {e.school && <span className="truncate">· {e.school}</span>}
                    {bookmarkSet.has(e.key) && <Bookmark className="size-3 fill-current text-primary" aria-label="Bookmarked" />}
                  </div>
                  <div className="line-clamp-2 text-sm font-medium">{e.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[0.6875rem] text-muted-foreground">
                    {e.languages.length > 0 && <span>{e.languages.join("/")}</span>}
                    {e.days.length > 0 && <span>{e.days.map((d) => DAYS.find(([n]) => n === d)?.[1] ?? "Sa").join(" ")}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {e.avg !== null && (
                    <span
                      className={cn("rounded px-1.5 py-0.5 text-xs/relaxed font-semibold tabular-nums", gradeTone(e.avg))}
                      title="Average grade (latest exam)"
                    >
                      {formatAverage(e.avg)}
                    </span>
                  )}
                  {e.fail !== null && (
                    <span className="text-[0.6875rem] text-muted-foreground tabular-nums">{formatPercent(e.fail, 0)} fail</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
        {visible.length > limit && (
          <li className="p-3">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="w-full rounded-md border py-1.5 text-xs/relaxed font-medium hover:bg-muted"
            >
              Show more ({(visible.length - limit).toLocaleString("en")} left)
            </button>
          </li>
        )}
        {visible.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">Nothing matches these filters.</li>
        )}
      </ul>
    </div>
  );
}
