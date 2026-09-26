"use client";

import { AlertTriangle, Copy, Download, Link2, MoreHorizontal, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { ChoiceCard } from "@/components/schedule/choice-card";
import { EntrySearch } from "@/components/schedule/entry-search";
import { GenerateDialog } from "@/components/schedule/generate-dialog";
import { WeekGrid } from "@/components/schedule/week-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildChoices } from "@/lib/planner/choices";
import type { TimetableCourse } from "@/lib/planner/queries";
import { findClashes, formatMinutes, toIcs, type WeeklySlot } from "@/lib/planner/timetable";
import { deleteSchedule, duplicateSchedule, setScheduleSharing, updateSchedule } from "@/lib/planning/actions";
import { summarize } from "@/lib/schedule/generate";
import type { ScheduleEntry } from "@/lib/schedule/queries";
import { calendarBlocks, COLORS, effectiveSelection, SKIP, slotsByGroup, type Selection } from "@/lib/schedule/selection";
import { formatSemester, type Semester } from "@/lib/stats/semester";
import { cn } from "@/lib/utils";

export type EditorSchedule = {
  id: string;
  name: string;
  semester: Semester;
  moduleCodes: string[];
  selection: Selection;
  shareToken: string | null;
};

export function ScheduleEditor({
  schedule,
  entries,
  courses,
  origin,
}: {
  schedule: EditorSchedule;
  entries: ScheduleEntry[];
  courses: TimetableCourse[];
  origin: string;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(schedule.selection);
  const [name, setName] = useState(schedule.name);
  const [shareToken, setShareToken] = useState(schedule.shareToken);
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keys = useMemo(() => entries.map((e) => e.key), [entries]);
  const colorOf = (key: string) => COLORS[Math.max(0, keys.indexOf(key)) % COLORS.length];
  const choices = useMemo(() => buildChoices(courses, keys), [courses, keys]);
  const slots = useMemo(() => slotsByGroup(choices), [choices]);
  const chosen = useMemo(() => effectiveSelection(choices, selection), [choices, selection]);
  const chosenSlots = useMemo(() => {
    const rec: Record<string, WeeklySlot[]> = {};
    for (const [key, groupId] of Object.entries(chosen)) rec[key] = slots.get(groupId) ?? [];
    return rec;
  }, [chosen, slots]);
  const clashes = findClashes(chosenSlots);
  const clashing = new Set(clashes.flat());
  const choiceByKey = new Map(choices.map((c) => [c.key, c]));
  const summary = summarize(Object.values(chosenSlots).flat());
  const ects = entries.reduce((sum, e) => sum + (e.ects ?? 0), 0);
  const withoutDates = entries.filter((e) => !choices.some((c) => c.moduleCode === e.key));
  const unresolved = choices.filter((c) => c.options.length > 1 && chosen[c.key] === undefined && selection[c.key] !== SKIP);

  useEffect(() => () => void (saveTimer.current && clearTimeout(saveTimer.current)), []);

  function persist(patch: Parameters<typeof updateSchedule>[1], refresh = false) {
    setSaveState("saving");
    updateSchedule(schedule.id, patch)
      .then(() => {
        setSaveState("saved");
        if (refresh) router.refresh();
      })
      .catch(() => setSaveState("error"));
  }

  function changeSelection(next: Selection) {
    setSelection(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => persist({ selection: next }), 500);
  }

  const setKeys = (next: string[]) => startTransition(() => persist({ moduleCodes: next }, true));

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
    const blob = new Blob([toIcs(events, `${name} · ${formatSemester(schedule.semester)}`)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "schedule"}-${schedule.semester}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const shareUrl = shareToken ? `${origin}/share/schedule/${shareToken}` : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Link href="/schedules" className="text-xs/relaxed text-muted-foreground hover:text-foreground">
            ← My schedules
          </Link>
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name !== schedule.name && persist({ name: name.trim() })}
              maxLength={60}
              aria-label="Schedule name"
              className="-ml-1 min-w-0 rounded-md bg-transparent px-1 text-2xl font-semibold tracking-tight outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
            />
          </div>
          <p className="text-xs/relaxed text-muted-foreground">
            {formatSemester(schedule.semester)} ·{" "}
            <span aria-live="polite">{saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn't save — retry" : "Saved"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setGenerating(true)} disabled={choices.every((c) => c.options.length < 2)}>
            <Sparkles /> Generate
          </Button>
          <Button variant="outline" onClick={exportIcs} disabled={Object.keys(chosen).length === 0}>
            <Download /> .ics
          </Button>
          <Button
            variant="outline"
            aria-pressed={!!shareToken}
            disabled={pending}
            onClick={() => startTransition(async () => setShareToken(await setScheduleSharing(schedule.id, !shareToken)))}
          >
            <Link2 /> {shareToken ? "Shared" : "Share"}
          </Button>
          <div className="relative">
            <Button variant="ghost" size="icon" aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal />
            </Button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-lg border bg-popover p-1 text-sm shadow-lg">
                <Link role="menuitem" href={`/schedules/compare?a=${schedule.id}`} className="block rounded-md px-2 py-1.5 hover:bg-muted">
                  Compare with…
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => startTransition(() => duplicateSchedule(schedule.id))}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <Copy className="size-3.5" /> Duplicate
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => confirm(`Delete "${name}"?`) && startTransition(() => deleteSchedule(schedule.id))}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {shareUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 p-2 text-xs/relaxed">
          <span className="text-muted-foreground">Anyone with this link can view this schedule (without your name):</span>
          <code className="rounded bg-background px-1.5 py-0.5">{shareUrl}</code>
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
            Copy
          </button>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["ECTS", ects ? String(ects) : "–"],
          ["Class hours / week", summary.classMinutes ? (summary.classMinutes / 60).toFixed(1) : "–"],
          ["Days on campus", summary.days.length ? String(summary.days.length) : "–"],
          [
            "Earliest – latest",
            summary.earliest !== null && summary.latest !== null ? `${formatMinutes(summary.earliest)} – ${formatMinutes(summary.latest)}` : "–",
          ],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {clashes.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs/relaxed text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <div>Time clash: {clashes.map(([a, b]) => `${choiceByKey.get(a)?.title} ↔ ${choiceByKey.get(b)?.title}`).join("; ")}</div>
        </div>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-3">
          <EntrySearch semester={schedule.semester} exclude={keys} onSelect={(key) => setKeys([...keys, key])} />
          <ul className="flex flex-wrap gap-1.5">
            {entries.map((e) => (
              <li key={e.key} className="flex items-center gap-1.5 rounded-full bg-card py-0.5 pr-1 pl-2.5 text-xs/relaxed ring-1 ring-foreground/10">
                <span className="size-2 rounded-full" style={{ background: colorOf(e.key) }} />
                <Link href={`/catalog/${schedule.semester}/${e.key}`} className="max-w-48 truncate hover:underline" title={e.title}>
                  {e.key.startsWith("C_") ? e.title : e.key}
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setKeys(keys.filter((k) => k !== e.key))}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${e.title}`}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
          {unresolved.length > 0 && (
            <p className="text-xs/relaxed text-muted-foreground">
              Choose a group for {unresolved.length} course{unresolved.length > 1 ? "s" : ""}, or let{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => setGenerating(true)}>
                Generate
              </button>{" "}
              find clash-free combinations.
            </p>
          )}
          {choices.map((ch) => (
            <ChoiceCard
              key={ch.key}
              choice={ch}
              color={colorOf(ch.moduleCode)}
              chosenGroup={chosen[ch.key]}
              skipped={selection[ch.key] === SKIP}
              slotsByGroup={slots}
              otherSlots={Object.entries(chosenSlots)
                .filter(([key]) => key !== ch.key)
                .flatMap(([, s]) => s)}
              inClash={clashing.has(ch.key)}
              onSelect={(groupId) => changeSelection({ ...selection, [ch.key]: groupId })}
            />
          ))}
          {withoutDates.length > 0 && (
            <p className="text-xs/relaxed text-muted-foreground">
              No regular dates published yet for {withoutDates.map((e) => (e.key.startsWith("C_") ? e.title : e.key)).join(", ")}.
            </p>
          )}
          {entries.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Add modules above or from the{" "}
                <Link href={`/catalog/${schedule.semester}`} className="text-primary hover:underline">
                  catalog
                </Link>
                .
              </CardContent>
            </Card>
          )}
        </div>
        <WeekGrid blocks={calendarBlocks(choices, chosen, slots, colorOf, clashing)} />
      </div>

      {generating && (
        <GenerateDialog
          choices={choices}
          slots={slots}
          selection={selection}
          colorOf={colorOf}
          onClose={() => setGenerating(false)}
          onApply={(next) => {
            changeSelection(next);
            setGenerating(false);
          }}
        />
      )}
      <p className={cn("mt-6 text-xs/relaxed text-muted-foreground")}>
        Dates come from TUMonline and can change; always check TUMonline before registering. Rooms link to NavigaTUM.
      </p>
    </div>
  );
}
