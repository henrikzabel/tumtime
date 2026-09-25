"use client";

import { AlertTriangle, Download, ExternalLink, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ModuleSearch } from "@/components/module-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildChoices, type Choice } from "@/lib/planner/choices";
import type { TimetableCourse } from "@/lib/planner/queries";
import {
  DAY_NAMES,
  findClashes,
  formatMinutes,
  formatSlot,
  overlaps,
  toIcs,
  weeklySlots,
  type WeeklySlot,
} from "@/lib/planner/timetable";
import { formatSemester, type Semester } from "@/lib/stats/semester";
import { cn } from "@/lib/utils";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const SKIP = -1; // "not attending"
const DAY_START = 8 * 60;
const DAY_END = 20 * 60;
const HOUR_PX = 44;

type Selection = Record<string, number>; // choice key → group id (or SKIP)

const storageKey = (semester: string) => `tumtime.timetable.v2:${semester}`;

function loadSelection(semester: string): Selection {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(semester)) ?? "{}") as Selection;
  } catch {
    return {};
  }
}

export function TimetableApp({
  semester,
  modules,
  courses,
}: {
  semester: Semester;
  modules: { code: string; name: string }[];
  courses: TimetableCourse[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selection, setSelection] = useState<Selection>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser-only storage once
    setSelection(loadSelection(semester));
  }, [semester]);

  const select = (key: string, groupId: number) => {
    setSelection((prev) => {
      const next = { ...prev, [key]: groupId };
      try {
        window.localStorage.setItem(storageKey(semester), JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const setModules = (codes: string[]) => {
    const params = new URLSearchParams({ semester });
    if (codes.length) params.set("modules", codes.join(","));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const moduleCodes = modules.map((m) => m.code);
  const colorOf = (code: string) => COLORS[Math.max(0, moduleCodes.indexOf(code)) % COLORS.length];

  const choices = useMemo(() => buildChoices(courses, modules.map((m) => m.code)), [courses, modules]);

  const slotsByGroup = useMemo(() => {
    const map = new Map<number, WeeklySlot[]>();
    for (const ch of choices) for (const o of ch.options) map.set(o.groupId, weeklySlots(o.events));
    return map;
  }, [choices]);

  // Effective choice: explicit selection, or the only option.
  const chosen = useMemo(() => {
    const out: Record<string, number> = {};
    for (const ch of choices) {
      const sel = selection[ch.key];
      if (sel === SKIP) continue;
      if (sel && ch.options.some((o) => o.groupId === sel)) out[ch.key] = sel;
      else if (ch.options.length === 1) out[ch.key] = ch.options[0].groupId;
    }
    return out;
  }, [choices, selection]);

  const chosenSlots = useMemo(() => {
    const rec: Record<string, WeeklySlot[]> = {};
    for (const [key, groupId] of Object.entries(chosen)) rec[key] = slotsByGroup.get(groupId) ?? [];
    return rec;
  }, [chosen, slotsByGroup]);

  const clashes = findClashes(chosenSlots);
  const clashing = new Set(clashes.flat());
  const choiceByKey = new Map(choices.map((c) => [c.key, c]));
  const modulesWithoutDates = modules.filter((m) => !choices.some((c) => c.moduleCode === m.code));
  const unresolved = choices.filter((c) => c.options.length > 1 && chosen[c.key] === undefined && selection[c.key] !== SKIP);

  const exportIcs = () => {
    const events = choices.flatMap((ch) => {
      const opt = ch.options.find((o) => o.groupId === chosen[ch.key]);
      if (!opt) return [];
      return opt.events
        .filter((e) => !e.canceled)
        .map((e, i) => ({
          uid: `${opt.courseId}-${opt.groupId}-${i}-${e.start}`,
          title: `${ch.title}${ch.options.length > 1 ? ` (${opt.label})` : ""}`,
          start: e.start,
          end: e.end,
          location: e.room,
          url: ch.tumonlineUrl,
        }));
    });
    const blob = new Blob([toIcs(events, `TUM ${formatSemester(semester)}`)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tumtime-${semester}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Timetable · {formatSemester(semester)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick one tutorial per module. Dates come from TUMonline; rooms link to NavigaTUM.
          </p>
        </div>
        <Button size="lg" onClick={exportIcs} disabled={Object.keys(chosen).length === 0}>
          <Download /> Export to calendar (.ics)
        </Button>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {modules.map((m) => (
          <span key={m.code} className="flex items-center gap-1.5 rounded-full bg-card py-0.5 pr-1 pl-2.5 text-xs/relaxed ring-1 ring-foreground/10">
            <span className="size-2 rounded-full" style={{ background: colorOf(m.code) }} />
            <span className="font-mono text-[0.6875rem] text-muted-foreground">{m.code}</span> {m.name}
            <button
              type="button"
              onClick={() => setModules(moduleCodes.filter((c) => c !== m.code))}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Remove ${m.code}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <div className="w-64">
          <ModuleSearch size="sm" placeholder="Add a module…" onSelect={(hit) => setModules([...new Set([...moduleCodes, hit.code])])} />
        </div>
      </div>

      {clashes.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs/relaxed text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <div>
            Time clash: {clashes.map(([a, b]) => `${choiceByKey.get(a)?.title} ↔ ${choiceByKey.get(b)?.title}`).join("; ")}
          </div>
        </div>
      )}

      {choices.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {modules.length === 0
              ? "Add modules above, or open the timetable from a semester in your study plan."
              : `No dates found for these modules in ${formatSemester(semester)} yet. TUMonline publishes dates shortly before the semester starts.`}
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            {unresolved.length > 0 && (
              <p className="text-xs/relaxed text-muted-foreground">
                Choose a group for {unresolved.length} course{unresolved.length > 1 ? "s" : ""}.
              </p>
            )}
            {choices.map((ch) => (
              <ChoiceCard
                key={ch.key}
                choice={ch}
                color={colorOf(ch.moduleCode)}
                chosenGroup={chosen[ch.key]}
                skipped={selection[ch.key] === SKIP}
                slotsByGroup={slotsByGroup}
                otherSlots={Object.entries(chosenSlots)
                  .filter(([key]) => key !== ch.key)
                  .flatMap(([, s]) => s)}
                inClash={clashing.has(ch.key)}
                onSelect={(groupId) => select(ch.key, groupId)}
              />
            ))}
            {modulesWithoutDates.length > 0 && (
              <p className="text-xs/relaxed text-muted-foreground">
                No dates published yet for {modulesWithoutDates.map((m) => m.code).join(", ")}.
              </p>
            )}
          </div>
          <WeekGrid
            blocks={choices.flatMap((ch) => {
              const opt = ch.options.find((o) => o.groupId === chosen[ch.key]);
              if (!opt) return [];
              return (slotsByGroup.get(opt.groupId) ?? []).map((s) => ({
                key: `${ch.key}-${opt.groupId}-${s.weekday}-${s.startMinutes}`,
                slot: s,
                title: ch.title,
                label: `${ch.activity ?? ""}${ch.options.length > 1 ? ` · ${opt.label}` : ""}`,
                color: colorOf(ch.moduleCode),
                clash: clashing.has(ch.key),
              }));
            })}
          />
        </div>
      )}
    </div>
  );
}

function ChoiceCard({
  choice,
  color,
  chosenGroup,
  skipped,
  slotsByGroup,
  otherSlots,
  inClash,
  onSelect,
}: {
  choice: Choice;
  color: string;
  chosenGroup: number | undefined;
  skipped: boolean;
  slotsByGroup: Map<number, WeeklySlot[]>;
  otherSlots: WeeklySlot[];
  inClash: boolean;
  onSelect: (groupId: number) => void;
}) {
  const describe = (groupId: number) =>
    (slotsByGroup.get(groupId) ?? []).map((s) => `${formatSlot(s)}${s.room ? ` · ${s.room}` : ""}`).join(", ") || "No regular dates";
  const clashesWithOthers = (groupId: number) =>
    (slotsByGroup.get(groupId) ?? []).some((s) => otherSlots.some((o) => overlaps(s, o)));
  const options = [...choice.options].sort((a, b) => {
    const sa = slotsByGroup.get(a.groupId)?.[0];
    const sb = slotsByGroup.get(b.groupId)?.[0];
    return (sa?.weekday ?? 9) - (sb?.weekday ?? 9) || (sa?.startMinutes ?? 0) - (sb?.startMinutes ?? 0);
  });

  return (
    <Card size="sm" className={cn(inClash && "ring-destructive/60")}>
      <CardHeader>
        <CardTitle className="flex items-start gap-2 text-xs/relaxed">
          <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="min-w-0 flex-1">
            {choice.title}
            <span className="mt-0.5 flex items-center gap-1.5 font-normal text-muted-foreground">
              {choice.activity && <Badge variant="outline">{choice.activity}</Badge>}
              {choice.options.length > 1 && `${choice.options.length} groups`}
              {choice.tumonlineUrl && (
                <a href={choice.tumonlineUrl} target="_blank" rel="noreferrer" className="hover:text-foreground" aria-label="Open in TUMonline">
                  <ExternalLink className="size-3" />
                </a>
              )}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {choice.options.length === 1 ? (
          <p className="text-[0.6875rem] text-muted-foreground">{describe(choice.options[0].groupId)}</p>
        ) : (
          <>
            <select
              value={skipped ? String(SKIP) : chosenGroup ? String(chosenGroup) : ""}
              onChange={(e) => onSelect(Number(e.target.value))}
              className={cn(
                "h-7 w-full rounded-md border border-input bg-input/20 px-2 text-xs/relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                !chosenGroup && !skipped && "border-primary/60",
              )}
              aria-label={`Group for ${choice.title}`}
            >
              <option value="" disabled>
                Choose a group…
              </option>
              {options.map((o) => (
                <option key={o.groupId} value={o.groupId}>
                  {describe(o.groupId)} — {o.label}
                  {clashesWithOthers(o.groupId) ? "  ⚠ clash" : ""}
                </option>
              ))}
              <option value={SKIP}>Not attending</option>
            </select>
            {chosenGroup && <p className="mt-1 text-[0.6875rem] text-muted-foreground">{describe(chosenGroup)}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

type Block = { key: string; slot: WeeklySlot; title: string; label: string; color: string; clash: boolean };

/** Monday–Friday grid; overlapping blocks share the column width. */
function WeekGrid({ blocks }: { blocks: Block[] }) {
  const hasWeekend = blocks.some((b) => b.slot.weekday > 5);
  const days = hasWeekend ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const start = Math.min(DAY_START, ...blocks.map((b) => Math.floor(b.slot.startMinutes / 60) * 60));
  const end = Math.max(DAY_END, ...blocks.map((b) => Math.ceil(b.slot.endMinutes / 60) * 60));
  const hours = Array.from({ length: (end - start) / 60 }, (_, i) => start / 60 + i);
  const top = (m: number) => ((m - start) / 60) * HOUR_PX;

  return (
    <div className="h-fit overflow-x-auto rounded-lg bg-card ring-1 ring-foreground/10 lg:sticky lg:top-16">
      <div className="grid min-w-[40rem]" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d} className="border-b py-2 text-center text-xs/relaxed font-medium">
            {DAY_NAMES[d]}
          </div>
        ))}
        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h) => (
            <div key={h} className="absolute right-1 text-[0.625rem] text-muted-foreground tabular-nums" style={{ top: top(h * 60) - 6 }}>
              {formatMinutes(h * 60)}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dayBlocks = blocks.filter((b) => b.slot.weekday === d).sort((a, b) => a.slot.startMinutes - b.slot.startMinutes);
          const lanes: number[] = [];
          const laneOf = new Map<string, number>();
          for (const b of dayBlocks) {
            let lane = lanes.findIndex((endMin) => endMin <= b.slot.startMinutes);
            if (lane === -1) lane = lanes.length;
            lanes[lane] = b.slot.endMinutes;
            laneOf.set(b.key, lane);
          }
          const laneCount = Math.max(1, lanes.length);
          return (
            <div key={d} className="relative border-l" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: top(h * 60) }} />
              ))}
              {dayBlocks.map((b) => {
                const lane = laneOf.get(b.key) ?? 0;
                return (
                  <div
                    key={b.key}
                    title={`${b.title} · ${formatSlot(b.slot)}${b.slot.room ? ` · ${b.slot.room}` : ""}`}
                    className={cn(
                      "absolute overflow-hidden rounded-md px-1.5 py-1 text-[0.625rem] leading-tight text-white shadow-xs",
                      b.clash && "ring-2 ring-destructive ring-offset-1",
                    )}
                    style={{
                      top: top(b.slot.startMinutes) + 1,
                      height: Math.max(18, top(b.slot.endMinutes) - top(b.slot.startMinutes) - 2),
                      left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                      width: `calc(${100 / laneCount}% - 4px)`,
                      background: b.color,
                    }}
                  >
                    <div className="font-semibold">{b.title}</div>
                    <div className="opacity-90">
                      {formatMinutes(b.slot.startMinutes)}–{formatMinutes(b.slot.endMinutes)} {b.label}
                    </div>
                    {b.slot.room && <div className="opacity-90">{b.slot.room}</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
