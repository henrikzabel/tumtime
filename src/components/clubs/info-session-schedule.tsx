"use client";

import { Printer, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { formatDay, formatLongDay, weekStart, type Slot } from "@/lib/clubs/info-sessions";
import { cn } from "@/lib/utils";

export type PublicSession = {
  id: number;
  clubName: string;
  clubSlug: string;
  tagline: string | null;
  focusAreas: string[];
  date: string;
  start: string;
  end: string;
  venue: string | null;
  campus: string | null;
  language: string | null;
  onlineUrl: string | null;
};

// Categorical tints for focus areas (text label always shown too, never colour alone).
const TINTS = ["#2a78d6", "#008236", "#c2410c", "#7c3aed", "#db2777", "#0e7490", "#a16207", "#4d7c0f", "#be123c", "#4338ca"];

const STAR_KEY = "tumtime:info-session-stars";

// Starred sessions live in localStorage (per browser, no account needed).
const listeners = new Set<() => void>();
let memory = "[]"; // fallback when storage is unavailable
function readRaw(): string {
  try {
    return localStorage.getItem(STAR_KEY) ?? "[]";
  } catch {
    return memory;
  }
}
function writeStars(ids: number[]) {
  memory = JSON.stringify(ids);
  try {
    localStorage.setItem(STAR_KEY, memory);
  } catch {
    // private mode: stars last for this visit only
  }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
}
function parseStars(raw: string): number[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

export function InfoSessionSchedule({
  dates,
  slots,
  sessions,
  today,
}: {
  dates: string[];
  slots: Slot[];
  sessions: PublicSession[];
  today: string;
}) {
  const [area, setArea] = useState<string | null>(null);
  const [campus, setCampus] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [starredOnly, setStarredOnly] = useState(false);
  const starsRaw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const stars = useMemo(() => parseStars(starsRaw), [starsRaw]);

  const areas = useMemo(() => [...new Set(sessions.flatMap((s) => s.focusAreas))].sort(), [sessions]);
  const campuses = useMemo(() => [...new Set(sessions.map((s) => s.campus).filter((c): c is string => !!c))].sort(), [sessions]);
  const tint = (a: string) => TINTS[areas.indexOf(a) % TINTS.length];

  const toggleStar = (id: number) => {
    writeStars(stars.includes(id) ? stars.filter((x) => x !== id) : [...stars, id]);
  };

  const visible = sessions.filter(
    (s) =>
      (!area || s.focusAreas.includes(area)) &&
      (!campus || s.campus === campus) &&
      (!language || s.language === language) &&
      (!starredOnly || stars.includes(s.id)),
  );
  const weeks = [...new Set(dates.map(weekStart))].map((w) => dates.filter((d) => weekStart(d) === w));
  const at = (date: string, start: string) => visible.filter((s) => s.date === date && s.start === start);
  const tonight = dates.includes(today) ? visible.filter((s) => s.date === today) : [];

  function renderSession(s: PublicSession, compact = false) {
    const starred = stars.includes(s.id);
    return (
      <div
        key={s.id}
        className={cn("group relative rounded-md border bg-card py-1.5 pr-6 pl-2.5 text-left break-inside-avoid", starred && "border-primary/60 bg-primary/5")}
        style={{ boxShadow: `inset 3px 0 0 ${s.focusAreas[0] ? tint(s.focusAreas[0]) : "var(--border)"}` }}
      >
        <Link href={`/clubs/${s.clubSlug}`} className="block text-xs/snug font-semibold hover:text-primary">
          {s.clubName}
        </Link>
        <div className="text-[0.625rem] text-muted-foreground">
          {[compact ? null : `${s.start}–${s.end}`, s.venue, s.language?.toUpperCase()].filter(Boolean).join(" · ")}
        </div>
        {!compact && s.tagline && <div className="mt-0.5 line-clamp-2 text-[0.625rem]">{s.tagline}</div>}
        <button
          type="button"
          onClick={() => toggleStar(s.id)}
          aria-pressed={starred}
          aria-label={starred ? `Remove ${s.clubName} from my plan` : `Add ${s.clubName} to my plan`}
          className="absolute top-1 right-1 rounded p-0.5 text-muted-foreground hover:text-primary print:hidden"
        >
          <Star className={cn("size-3.5", starred && "fill-primary text-primary")} />
        </button>
      </div>
    );
  }

  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-2 py-0.5 text-xs/relaxed transition-colors",
      on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        <button type="button" className={chip(starredOnly)} onClick={() => setStarredOnly(!starredOnly)}>
          <Star className="mr-1 inline size-3 align-[-2px]" />
          My plan ({stars.filter((id) => sessions.some((s) => s.id === id)).length})
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        {areas.map((a) => (
          <button key={a} type="button" className={chip(area === a)} onClick={() => setArea(area === a ? null : a)}>
            <span className="mr-1 inline-block size-2 rounded-full" style={{ background: tint(a) }} />
            {a}
          </button>
        ))}
        {campuses.length > 1 && <span className="mx-1 h-4 w-px bg-border" />}
        {campuses.length > 1 &&
          campuses.map((c) => (
            <button key={c} type="button" className={chip(campus === c)} onClick={() => setCampus(campus === c ? null : c)}>
              {c}
            </button>
          ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {["en", "de"].map((l) => (
          <button key={l} type="button" className={chip(language === l)} onClick={() => setLanguage(language === l ? null : l)}>
            {l === "en" ? "English" : "German"}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => window.print()}>
          <Printer /> Print weekly plan
        </Button>
      </div>

      {tonight.length > 0 && (
        <section className="rounded-lg bg-primary/6 p-4 ring-1 ring-primary/20 print:hidden">
          <h2 className="text-sm font-semibold">Tonight · {formatLongDay(today)}</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {tonight.map((s) => (
              renderSession(s)
            ))}
          </div>
        </section>
      )}

      {weeks.map((week, wi) => (
        <section key={week[0]} className="break-inside-avoid">
          <h2 className="text-sm font-semibold">
            Week {wi + 1} <span className="font-normal text-muted-foreground">· {formatDay(week[0])} – {formatDay(week.at(-1)!)}</span>
          </h2>
          {/* Grid on wide screens, list per night on phones. */}
          <div className="mt-2 hidden overflow-x-auto md:block print:block">
            <table className="w-full table-fixed border-separate border-spacing-1.5">
              <thead>
                <tr>
                  <th className="w-14" />
                  {week.map((d) => (
                    <th key={d} className={cn("text-xs font-semibold", d === today && "text-primary")}>
                      {formatDay(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.start}>
                    <th className="align-top text-[0.6875rem] font-normal text-muted-foreground tabular-nums">
                      {slot.start}
                      <br />
                      {slot.end}
                    </th>
                    {week.map((d) => (
                      <td key={d} className={cn("align-top", d < today && "opacity-50")}>
                        <div className="space-y-1">
                          {at(d, slot.start).map((s) => (
                            renderSession(s, true)
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 space-y-4 md:hidden print:hidden">
            {week.map((d) => {
              const day = visible.filter((s) => s.date === d);
              if (day.length === 0) return null;
              return (
                <div key={d} className={cn(d < today && "opacity-50")}>
                  <h3 className={cn("text-xs font-semibold", d === today && "text-primary")}>{formatLongDay(d)}</h3>
                  <div className="mt-1 space-y-1">
                    {day.map((s) => (
                      renderSession(s)
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {visible.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No sessions match these filters.</p>}
    </div>
  );
}
