"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CalendarDays,
  ChevronDown,
  Copy,
  Link2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { ModuleSearch } from "@/components/module-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAverage, formatPercent } from "@/lib/format";
import {
  addItem,
  addSemester,
  BACHELOR_CREDITS,
  computeProgress,
  createPlan,
  cycleWarning,
  fillPlaceholder,
  moveItem,
  newItemId,
  removeItem,
  removeLastSemester,
  semesterCredits,
  termLabel,
  termOf,
  type PlannedItem,
  type PlanState,
  type StudyPlanData,
} from "@/lib/planner/plan";
import { LABELS } from "@/lib/planner/labels";
import type { PlannerModuleInfo } from "@/lib/planner/queries";
import {
  deleteDegreePlan,
  duplicateDegreePlan,
  openSemesterInScheduler,
  saveDegreePlan,
  setDegreePlanSharing,
} from "@/lib/planning/actions";
import type { Semester } from "@/lib/stats/semester";
import { cn } from "@/lib/utils";

type ProgramInfo = {
  slug: string;
  nameEn: string;
  nameDe: string;
  degree: string;
  sourceUrl: string | null;
};
type SearchHit = {
  code: string;
  nameEn: string | null;
  nameDe: string | null;
  ects: number | null;
};
export type BookmarkInfo = { code: string; title: string; ects: number | null };

export function DegreePlanner({
  plan,
  program,
  plans,
  initialModuleInfos,
  planningSemester,
  schedulerSemesters,
  bookmarks,
  origin,
}: {
  plan: {
    id: string;
    name: string;
    state: PlanState;
    shareToken: string | null;
  };
  program: ProgramInfo;
  plans: StudyPlanData[];
  initialModuleInfos: PlannerModuleInfo[];
  planningSemester: Semester;
  schedulerSemesters: Semester[];
  bookmarks: BookmarkInfo[];
  origin: string;
}) {
  const [state, setState] = useState<PlanState>(plan.state);
  const [name, setName] = useState(plan.name);
  const [shareToken, setShareToken] = useState(plan.shareToken);
  const [infos, setInfos] = useState<Record<string, PlannerModuleInfo>>(() =>
    Object.fromEntries(initialModuleInfos.map((m) => [m.code, m])),
  );
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (patch: { state?: PlanState; name?: string }) => {
      setSaveState("saving");
      saveDegreePlan(plan.id, patch)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    },
    [plan.id],
  );

  const update = useCallback(
    (next: PlanState | ((s: PlanState) => PlanState)) => {
      setState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        if (timer.current) clearTimeout(timer.current);
        setSaveState("saving");
        timer.current = setTimeout(() => persist({ state: value }), 600);
        return value;
      });
    },
    [persist],
  );

  useEffect(
    () => () => void (timer.current && clearTimeout(timer.current)),
    [],
  );

  // Card data (names, cycle, grades) for modules added later.
  useEffect(() => {
    const missing = [
      ...new Set(
        Object.values(state.semesters).flatMap((items) =>
          items.map((i) => i.moduleCode).filter(Boolean),
        ),
      ),
    ].filter((c) => !infos[c!]) as string[];
    if (missing.length === 0) return;
    fetch(`/api/planner/modules?codes=${missing.slice(0, 60).join(",")}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: PlannerModuleInfo[]) =>
        setInfos((prev) => ({
          ...prev,
          ...Object.fromEntries(list.map((m) => [m.code, m])),
        })),
      )
      .catch(() => {});
  }, [state, infos]);

  const studyPlan = plans.find((p) => p.id === state.studyPlanId) ?? plans[0];
  const progress = computeProgress(state, studyPlan);
  const semesterNumbers = Object.keys(state.semesters)
    .map(Number)
    .sort((a, b) => a - b);
  const areaOptions = [
    ...new Set([
      ...studyPlan.requirements.map((r) => r.area),
      ...studyPlan.entries.map((e) => e.area).filter((a): a is string => !!a),
    ]),
  ];
  const allItems = Object.values(state.semesters).flat();
  const completed = allItems
    .filter((i) => i.label === "done")
    .reduce((s, i) => s + i.credits, 0);
  const planned = new Set(allItems.map((i) => i.moduleCode).filter(Boolean));
  const shareUrl = shareToken ? `${origin}/share/plan/${shareToken}` : null;

  const addModule = (n: number, hit: SearchHit, area: string | null) =>
    update((s) =>
      addItem(s, n, {
        id: newItemId(),
        kind: "module",
        moduleCode: hit.code,
        title: hit.nameEn ?? hit.nameDe ?? hit.code,
        credits: hit.ects ?? 5,
        area,
      }),
    );

  return (
    <div className="px-4 py-6">
      <header className="mx-auto flex max-w-[100rem] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Link
            href="/degree-planner"
            className="text-xs/relaxed text-muted-foreground hover:text-foreground"
          >
            ← My plans
          </Link>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() =>
              name.trim() &&
              name !== plan.name &&
              persist({ name: name.trim() })
            }
            maxLength={60}
            aria-label="Plan name"
            className="-ml-1 block w-full min-w-0 rounded-md bg-transparent px-1 text-2xl font-semibold tracking-tight outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
          />
          <p className="text-xs/relaxed text-muted-foreground">
            {program.degree} {program.nameEn} · started{" "}
            {termLabel(state.startSemester, 1)} · {studyPlan.title} ·{" "}
            <span aria-live="polite">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "error"
                  ? "Couldn't save"
                  : "Saved"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            aria-pressed={!!shareToken}
            disabled={pending}
            onClick={() =>
              startTransition(async () =>
                setShareToken(await setDegreePlanSharing(plan.id, !shareToken)),
              )
            }
          >
            <Link2 /> {shareToken ? "Shared" : "Share"}
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label="More actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal />
            </Button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-56 rounded-lg border bg-popover p-1 text-sm shadow-lg"
              >
                <button
                  role="menuitem"
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    if (
                      confirm(
                        "Reset to the recommended study plan? Your changes will be lost.",
                      )
                    ) {
                      update(
                        createPlan(
                          program.slug,
                          studyPlan,
                          state.startSemester,
                        ),
                      );
                    }
                  }}
                >
                  <RotateCcw className="size-3.5" /> Reset to recommended plan
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                  onClick={() =>
                    startTransition(() => duplicateDegreePlan(plan.id))
                  }
                >
                  <Copy className="size-3.5" /> Duplicate
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    confirm(`Delete "${name}"?`) &&
                    startTransition(() => deleteDegreePlan(plan.id))
                  }
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {shareUrl && (
        <div className="mx-auto mt-3 flex max-w-[100rem] flex-wrap items-center gap-2 rounded-lg bg-muted/60 p-2 text-xs/relaxed">
          <span className="text-muted-foreground">
            Anyone with this link can view this plan (without your name):
          </span>
          <code className="rounded bg-background px-1.5 py-0.5">
            {shareUrl}
          </code>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => navigator.clipboard?.writeText(shareUrl)}
          >
            Copy
          </button>
        </div>
      )}

      <div className="mx-auto mt-5 grid max-w-[100rem] gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 overflow-x-auto pb-3">
          <div className="flex gap-3">
            {semesterNumbers.map((n) => {
              const term = termOf(state.startSemester, n);
              const items = state.semesters[n] ?? [];
              const codes = items
                .map((i) => i.moduleCode)
                .filter((c): c is string => !!c);
              return (
                <SemesterColumn
                  key={n}
                  number={n}
                  term={term}
                  note={state.semesterNotes?.[n] ?? ""}
                  items={items}
                  infos={infos}
                  areaOptions={areaOptions}
                  isPlanningTerm={term === planningSemester}
                  canMoveLeft={n > 1}
                  canMoveRight={n < semesterNumbers.length}
                  onNote={(note) =>
                    update((s) => ({
                      ...s,
                      semesterNotes: { ...s.semesterNotes, [n]: note },
                    }))
                  }
                  onMove={(id, dir) => update((s) => moveItem(s, id, n + dir))}
                  onDrop={(payload) => {
                    if (payload.startsWith("item:"))
                      update((s) => moveItem(s, payload.slice(5), n));
                    if (payload.startsWith("bookmark:")) {
                      const b = bookmarks.find(
                        (x) => x.code === payload.slice(9),
                      );
                      if (b)
                        addModule(
                          n,
                          {
                            code: b.code,
                            nameEn: b.title,
                            nameDe: null,
                            ects: b.ects,
                          },
                          null,
                        );
                    }
                  }}
                  onRemove={(id) => update((s) => removeItem(s, id))}
                  onLabel={(id, label) =>
                    update((s) => ({
                      ...s,
                      semesters: Object.fromEntries(
                        Object.entries(s.semesters).map(([k, list]) => [
                          k,
                          list.map((i) =>
                            i.id === id
                              ? { ...i, label: label || undefined }
                              : i,
                          ),
                        ]),
                      ),
                    }))
                  }
                  onFill={(id, hit) =>
                    update((s) =>
                      fillPlaceholder(s, id, {
                        code: hit.code,
                        title: hit.nameEn ?? hit.nameDe ?? hit.code,
                        credits: hit.ects ?? 5,
                      }),
                    )
                  }
                  onAdd={(hit, area) => addModule(n, hit, area)}
                  onSchedule={
                    schedulerSemesters.includes(term) && codes.length
                      ? () =>
                          startTransition(() =>
                            openSemesterInScheduler(term, codes, name),
                          )
                      : undefined
                  }
                />
              );
            })}
            <div className="flex w-44 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-xs/relaxed text-muted-foreground">
              <Button variant="outline" onClick={() => update(addSemester)}>
                <Plus /> Add semester
              </Button>
              {semesterNumbers.length > 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update(removeLastSemester)}
                >
                  Remove last empty
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <RequirementsPanel progress={progress} completed={completed} />
          <section className="rounded-lg bg-card p-3 ring-1 ring-foreground/10">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Bookmark className="size-3.5" /> Bookmarks
            </h2>
            {bookmarks.length === 0 ? (
              <p className="mt-1 text-xs/relaxed text-muted-foreground">
                Bookmark modules in the{" "}
                <Link href="/catalog" className="text-primary hover:underline">
                  catalog
                </Link>{" "}
                and drag them into a semester.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {bookmarks.map((b) => (
                  <li
                    key={b.code}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plan", `bookmark:${b.code}`);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className={cn(
                      "cursor-grab rounded-md px-2 py-1 text-xs/relaxed ring-1 ring-foreground/10 active:cursor-grabbing",
                      planned.has(b.code) && "opacity-50",
                    )}
                    title={
                      planned.has(b.code)
                        ? "Already in your plan"
                        : "Drag into a semester"
                    }
                  >
                    <span className="font-mono text-[0.6875rem] text-muted-foreground">
                      {b.code}
                    </span>{" "}
                    {b.title}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {studyPlan.footnotes.length > 0 && (
            <details className="rounded-lg bg-muted/50 p-3 text-xs/relaxed text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                Notes from the official study plan
              </summary>
              <ul className="mt-2 space-y-1.5">
                {studyPlan.footnotes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {program.sourceUrl && (
                <a
                  href={program.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-primary hover:underline"
                >
                  Source: TUM School of CIT →
                </a>
              )}
            </details>
          )}
          <p className="text-xs/relaxed text-muted-foreground">
            Unofficial — always check your FPSO and TUMonline.
          </p>
        </aside>
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full",
          value >= max ? "bg-primary" : "bg-primary/60",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** GradTrak-style requirements side panel. */
function RequirementsPanel({
  progress,
  completed,
}: {
  progress: ReturnType<typeof computeProgress>;
  completed: number;
}) {
  const { requiredModules: req } = progress;
  return (
    <section className="space-y-3 rounded-lg bg-card p-3 ring-1 ring-foreground/10">
      <h2 className="text-sm font-semibold">Requirements</h2>
      <div>
        <div className="flex items-baseline justify-between text-xs/relaxed">
          <span className="font-medium">Total credits</span>
          <span className="tabular-nums text-muted-foreground">
            {progress.totalCredits} / {BACHELOR_CREDITS}
          </span>
        </div>
        <ProgressBar
          value={progress.totalCredits}
          max={BACHELOR_CREDITS}
          className="mt-1"
        />
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">
          {completed} ECTS completed · {progress.concreteCredits} ECTS in chosen
          modules
        </p>
      </div>
      <div>
        <div className="flex items-baseline justify-between text-xs/relaxed">
          <span className="font-medium">Required modules</span>
          <span className="tabular-nums text-muted-foreground">
            {req.planned} / {req.total}
          </span>
        </div>
        <ProgressBar value={req.planned} max={req.total} className="mt-1" />
        {req.missing.length > 0 && (
          <p className="mt-1 text-[0.6875rem] text-destructive">
            Missing: {req.missing.join(", ")}
          </p>
        )}
      </div>
      {progress.requirements.map((r) => (
        <details key={r.area} className="group">
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 text-xs/relaxed">
            <span className="flex min-w-0 items-center gap-1 font-medium">
              <ChevronDown className="size-3 shrink-0 transition-transform group-open:rotate-180" />
              <span className="truncate" title={r.area}>
                {r.area}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {r.planned} / {r.required} ECTS
            </span>
          </summary>
          <ProgressBar value={r.planned} max={r.required} className="mt-1" />
          <p className="mt-1 text-[0.6875rem] text-muted-foreground">
            {r.planned >= r.required
              ? "Fulfilled by your plan."
              : `${r.required - r.planned} ECTS still to plan.`}
          </p>
        </details>
      ))}
    </section>
  );
}

function SemesterColumn({
  number,
  term,
  note,
  items,
  infos,
  areaOptions,
  isPlanningTerm,
  canMoveLeft,
  canMoveRight,
  onNote,
  onMove,
  onDrop,
  onRemove,
  onLabel,
  onFill,
  onAdd,
  onSchedule,
}: {
  number: number;
  term: Semester;
  note: string;
  items: PlannedItem[];
  infos: Record<string, PlannerModuleInfo>;
  areaOptions: string[];
  isPlanningTerm: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onNote: (note: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDrop: (payload: string) => void;
  onRemove: (id: string) => void;
  onLabel: (id: string, label: string) => void;
  onFill: (id: string, hit: SearchHit) => void;
  onAdd: (hit: SearchHit, area: string | null) => void;
  onSchedule?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [area, setArea] = useState<string>(areaOptions[0] ?? "");
  const [dragOver, setDragOver] = useState(false);
  const credits = semesterCredits(items);

  return (
    <section
      aria-label={`Semester ${number}`}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg bg-card ring-1 ring-foreground/10 transition-shadow",
        isPlanningTerm && "ring-primary/50",
        dragOver && "ring-2 ring-primary/60",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const payload = e.dataTransfer.getData("text/plan");
        if (payload) onDrop(payload);
      }}
    >
      <header className="border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Semester {number}{" "}
            <span className="font-normal text-muted-foreground">
              · {termLabel(term, 1)}
            </span>
          </h3>
          <span
            className={cn(
              "text-xs/relaxed tabular-nums",
              credits > 36 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {credits} ECTS
          </span>
        </div>
        <input
          defaultValue={note}
          onBlur={(e) =>
            e.target.value !== note && onNote(e.target.value.slice(0, 60))
          }
          placeholder={
            isPlanningTerm ? "Next semester" : "Add a note (e.g. abroad)"
          }
          aria-label={`Note for semester ${number}`}
          className="mt-0.5 w-full bg-transparent text-[0.6875rem] text-muted-foreground outline-none placeholder:text-muted-foreground/60"
        />
      </header>
      <div className="flex-1 space-y-1.5 p-2">
        {items.map((item) => (
          <PlanItemCard
            key={item.id}
            item={item}
            info={item.moduleCode ? infos[item.moduleCode] : undefined}
            term={term}
            canMoveLeft={canMoveLeft}
            canMoveRight={canMoveRight}
            onMove={(dir) => onMove(item.id, dir)}
            onRemove={() => onRemove(item.id)}
            onLabel={(label) => onLabel(item.id, label)}
            onFill={(hit) => onFill(item.id, hit)}
          />
        ))}
        {items.length === 0 && (
          <p className="py-3 text-center text-xs/relaxed text-muted-foreground">
            Drop modules here
          </p>
        )}
        {adding ? (
          <div className="space-y-1.5 rounded-md bg-muted/50 p-2">
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs/relaxed"
              aria-label="Counts towards"
            >
              {areaOptions.map((a) => (
                <option key={a} value={a}>
                  Counts towards: {a}
                </option>
              ))}
              <option value="">Other / extra</option>
            </select>
            <ModuleSearch
              size="sm"
              autoFocus
              placeholder="Search module…"
              onSelect={(hit) => {
                onAdd(hit, area || null);
                setAdding(false);
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
              <Plus /> Add module
            </Button>
            {onSchedule && (
              <Button variant="secondary" size="sm" onClick={onSchedule}>
                <CalendarDays /> Schedule
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function PlanItemCard({
  item,
  info,
  term,
  canMoveLeft,
  canMoveRight,
  onMove,
  onRemove,
  onLabel,
  onFill,
}: {
  item: PlannedItem;
  info?: PlannerModuleInfo;
  term: Semester;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onLabel: (label: string) => void;
  onFill: (hit: SearchHit) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const warning = info ? cycleWarning(info.cycle, term) : null;
  const isPlaceholder = item.kind === "placeholder";
  const label = item.label ? LABELS[item.label] : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plan", `item:${item.id}`);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group/item cursor-grab rounded-md p-2 text-xs/relaxed ring-1 transition-colors active:cursor-grabbing",
        isPlaceholder
          ? "border border-dashed border-primary/40 bg-primary/5 ring-transparent"
          : "bg-background ring-foreground/10",
        item.label === "done" && "bg-primary/5",
      )}
    >
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          {isPlaceholder ? (
            <div className="font-medium text-primary">{item.title}</div>
          ) : (
            <Link
              href={`/catalog/${term}/${encodeURIComponent(item.moduleCode!)}`}
              className="block hover:underline"
            >
              <span className="font-mono text-[0.6875rem] text-muted-foreground">
                {item.moduleCode}
              </span>{" "}
              <span className="font-medium">{info?.nameEn ?? item.title}</span>
            </Link>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-muted-foreground">
            <span className="tabular-nums">{item.credits} ECTS</span>
            {label && (
              <span className={cn("rounded px-1 font-medium", label.className)}>
                {label.text}
              </span>
            )}
            {item.area && !isPlaceholder && (
              <Badge variant="outline" className="max-w-40 truncate">
                {item.area}
              </Badge>
            )}
            {info?.stats && (
              <span
                title={`Latest exam: ${info.stats.semester}`}
                className="tabular-nums"
              >
                Ø {formatAverage(info.stats.averageTotal)} ·{" "}
                {formatPercent(info.stats.failureRate, 0)} failed
              </span>
            )}
          </div>
          {warning && (
            <div className="mt-1 flex items-center gap-1 text-[0.6875rem] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3" /> {warning}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center opacity-60 transition-opacity group-hover/item:opacity-100">
          {!isPlaceholder && (
            <label
              className="relative inline-grid size-5 place-items-center rounded hover:bg-muted"
              title="Label"
            >
              <Tag className="size-3" />
              <select
                value={item.label ?? ""}
                onChange={(e) => onLabel(e.target.value)}
                aria-label="Label"
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                <option value="">No label</option>
                {Object.entries(LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.text}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!canMoveLeft}
            onClick={() => onMove(-1)}
            aria-label="Move to previous semester"
          >
            <ArrowLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={!canMoveRight}
            onClick={() => onMove(1)}
            aria-label="Move to next semester"
          >
            <ArrowRight />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            aria-label="Remove"
          >
            <X />
          </Button>
        </div>
      </div>
      {isPlaceholder &&
        (choosing ? (
          <div className="mt-2">
            <ModuleSearch
              size="sm"
              autoFocus
              placeholder="Pick an elective…"
              onSelect={(hit) => {
                onFill(hit);
                setChoosing(false);
              }}
            />
          </div>
        ) : (
          <Button
            variant="link"
            size="xs"
            className="mt-1 px-0"
            onClick={() => setChoosing(true)}
          >
            Choose module →
          </Button>
        ))}
    </div>
  );
}
