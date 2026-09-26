"use client";

import { CalendarDays, Clock, Search, SlidersHorizontal, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CLUB_SORTS,
  clubFiltersFromParams,
  clubFiltersToParams,
  DEFAULT_CLUB_FILTERS,
  filterClubs,
  isRecruiting,
  type ClubFilters,
  type ClubListItem,
} from "@/lib/clubs/directory";
import { formatShortDate } from "@/lib/clubs/info-sessions";
import { AUDIENCES, COMMITMENT_BUCKETS, formatHours, LANGUAGES, type Audience, type Language } from "@/lib/clubs/profile";
import { cn } from "@/lib/utils";

const PAGE = 80;

const selectClass =
  "h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs/relaxed text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30";


function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[0.6875rem] font-medium transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function ClubBrowser({ clubs, banner }: { clubs: ClubListItem[]; banner?: React.ReactNode }) {
  const searchParams = useSearchParams();
  const selected = useSelectedLayoutSegment();
  const [filters, setFilters] = useState<ClubFilters>(() => clubFiltersFromParams(new URLSearchParams(searchParams.toString())));
  const [limit, setLimit] = useState(PAGE);
  const [showFilters, setShowFilters] = useState(false);

  const areas = useMemo(() => [...new Set(clubs.flatMap((c) => c.focusAreas))].sort(), [clubs]);
  const campuses = useMemo(() => [...new Set(clubs.flatMap((c) => c.locations))].sort(), [clubs]);
  const visible = useMemo(() => filterClubs(clubs, filters), [clubs, filters]);
  const query = clubFiltersToParams(filters).toString();
  const panelFilters = (["area", "campus", "hours", "language", "audience", "free"] as const).filter(
    (k) => JSON.stringify(filters[k]) !== JSON.stringify(DEFAULT_CLUB_FILTERS[k]),
  ).length;

  function update(patch: Partial<ClubFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setLimit(PAGE);
    const qs = clubFiltersToParams(next).toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Search clubs, e.g. robotics, consulting…"
              aria-label="Search clubs"
              className="h-8 w-full rounded-md border border-input bg-input/20 pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs/relaxed transition-colors hover:bg-muted",
              panelFilters > 0 && "border-primary text-primary",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters{panelFilters > 0 ? ` (${panelFilters})` : ""}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Toggle on={filters.recruiting} onClick={() => update({ recruiting: !filters.recruiting })}>
            Recruiting now
          </Toggle>
          <Toggle on={filters.infoSession} onClick={() => update({ infoSession: !filters.infoSession })}>
            <CalendarDays className="size-3" /> Info session
          </Toggle>
          {COMMITMENT_BUCKETS.slice(0, 2).map((b) => {
            const on = filters.hours.includes(b.value);
            return (
              <Toggle
                key={b.value}
                on={on}
                onClick={() => update({ hours: on ? filters.hours.filter((h) => h !== b.value) : [...filters.hours, b.value] })}
              >
                <Clock className="size-3" /> {b.label}
              </Toggle>
            );
          })}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 pt-1 text-xs/relaxed">
            <label className="flex flex-col gap-1 text-muted-foreground">
              Focus area
              <select className={selectClass} value={filters.area ?? ""} onChange={(e) => update({ area: e.target.value || null })}>
                <option value="">All areas</option>
                {areas.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground">
              Campus
              <select className={selectClass} value={filters.campus ?? ""} onChange={(e) => update({ campus: e.target.value || null })}>
                <option value="">All campuses</option>
                {campuses.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground">
              Language
              <select
                className={selectClass}
                value={filters.language ?? ""}
                onChange={(e) => update({ language: (e.target.value || null) as Language | null })}
              >
                <option value="">Any language</option>
                {Object.entries(LANGUAGES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground">
              Open to
              <select
                className={selectClass}
                value={filters.audience ?? ""}
                onChange={(e) => update({ audience: (e.target.value || null) as Audience | null })}
              >
                <option value="">Everyone</option>
                {Object.entries(AUDIENCES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <div className="col-span-2 flex flex-col gap-1 text-muted-foreground">
              Time per week
              <div className="flex gap-1">
                {COMMITMENT_BUCKETS.map((b) => {
                  const on = filters.hours.includes(b.value);
                  return (
                    <button
                      key={b.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update({ hours: on ? filters.hours.filter((h) => h !== b.value) : [...filters.hours, b.value] })}
                      className={cn(
                        "h-7 flex-1 rounded-md border text-xs/relaxed transition-colors",
                        on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-foreground">
              <input
                type="checkbox"
                className="size-3.5 accent-[var(--primary)]"
                checked={filters.free}
                onChange={(e) => update({ free: e.target.checked })}
              />
              Free membership
            </label>
            {panelFilters > 0 && (
              <button
                type="button"
                onClick={() => update({ ...DEFAULT_CLUB_FILTERS, q: filters.q, sort: filters.sort, recruiting: filters.recruiting, infoSession: filters.infoSession })}
                className="inline-flex items-center justify-center gap-1 rounded-md py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" /> Clear filters
              </button>
            )}
            <p className="col-span-2 text-[0.6875rem] text-muted-foreground">
              Time, language and audience filters only include clubs that filled in their profile.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs/relaxed text-muted-foreground">
          <span>
            {visible.length} {visible.length === 1 ? "club" : "clubs"}
          </span>
          <label className="flex items-center gap-1">
            Sort
            <select
              className="bg-transparent font-medium text-foreground outline-none"
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as ClubFilters["sort"] })}
            >
              {Object.entries(CLUB_SORTS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Clubs">
        {banner && <li className="border-b">{banner}</li>}
        {visible.slice(0, limit).map((c, i) => {
          const active = selected !== null && decodeURIComponent(selected) === c.slug;
          const hours = formatHours(c.hoursMin, c.hoursMax);
          return (
            <li key={c.slug}>
              <Link
                href={`/clubs/${c.slug}${query ? `?${query}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex gap-3 border-b px-3 py-2.5 transition-colors hover:bg-muted/60",
                  active && "bg-primary/8 shadow-[inset_3px_0_0_var(--primary)]",
                )}
              >
                <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-foreground/5">
                  {c.imageUrl ? (
                    <Image src={c.imageUrl} alt="" fill sizes="44px" loading={i < 12 ? "eager" : "lazy"} className="object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-sm font-semibold text-muted-foreground">{c.name[0]}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span className="line-clamp-1 flex-1 text-sm font-medium">{c.name}</span>
                    {isRecruiting(c) && (
                      <span className="shrink-0 rounded-full bg-primary/12 px-1.5 text-[0.625rem] font-semibold text-primary">Recruiting</span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs/relaxed text-muted-foreground">{c.tagline ?? c.summary ?? c.focusAreas.join(", ")}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[0.6875rem] text-muted-foreground">
                    {hours && (
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="size-3" /> {hours}
                      </span>
                    )}
                    {c.memberCount !== null && (
                      <span className="inline-flex items-center gap-0.5">
                        <Users className="size-3" /> {c.memberCount}
                      </span>
                    )}
                    {c.locations.length > 0 && <span className="truncate">{c.locations.slice(0, 2).join(", ")}</span>}
                    {c.languages.length > 0 && <span className="uppercase">{c.languages.join("/")}</span>}
                    {c.nextInfoSession && (
                      <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                        <CalendarDays className="size-3" /> Info {formatShortDate(new Date(c.nextInfoSession))}
                      </span>
                    )}
                    {c.nextDeadline && <span className="font-medium text-[#8a5d00] dark:text-[#f5c451]">Apply by {formatShortDate(new Date(c.nextDeadline))}</span>}
                  </div>
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
              Show more ({visible.length - limit} left)
            </button>
          </li>
        )}
        {visible.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No clubs match these filters.</li>}
      </ul>
    </div>
  );
}
