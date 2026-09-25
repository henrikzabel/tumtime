"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, Link2, Plus, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ModuleSearch } from "@/components/module-search";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAverage, formatPercent } from "@/lib/format";
import {
  addItem,
  addSemester,
  BACHELOR_CREDITS,
  computeProgress,
  createPlan,
  cycleWarning,
  decodePlan,
  encodePlan,
  fillPlaceholder,
  moveItem,
  newItemId,
  removeItem,
  removeLastSemester,
  semesterCredits,
  studyPlanFor,
  termLabel,
  termOf,
  type PlannedItem,
  type PlanState,
  type StudyPlanData,
} from "@/lib/planner/plan";
import type { PlannerModuleInfo } from "@/lib/planner/queries";
import { semesterKey, type Semester } from "@/lib/stats/semester";
import { cn } from "@/lib/utils";

type ProgramInfo = { slug: string; nameEn: string; nameDe: string; degree: string; sourceUrl: string | null };

const storageKey = (slug: string) => `tumtime.plan.v1:${slug}`;

function loadPlan(slug: string): PlanState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as PlanState) : null;
  } catch {
    return null;
  }
}

function savePlan(state: PlanState) {
  try {
    window.localStorage.setItem(storageKey(state.program), JSON.stringify(state));
  } catch {
    // storage unavailable (private mode) — the plan still works for this session
  }
}

/** Starting semesters students can choose from: the last five years up to the next term. */
function startOptions(planning: Semester): Semester[] {
  const last = semesterKey(planning) + 1;
  const out: Semester[] = [];
  for (let k = last; k > last - 11; k--) out.push(`${Math.floor(k / 2)}${k % 2 === 1 ? "WS" : "SS"}` as Semester);
  return out;
}

export function PlannerApp({
  program,
  plans,
  initialModuleInfos,
  planningSemester,
}: {
  program: ProgramInfo;
  plans: StudyPlanData[];
  initialModuleInfos: PlannerModuleInfo[];
  planningSemester: Semester;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<PlanState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [infos, setInfos] = useState<Record<string, PlannerModuleInfo>>(() =>
    Object.fromEntries(initialModuleInfos.map((m) => [m.code, m])),
  );
  const [copied, setCopied] = useState(false);

  // Load: a shared link (?plan=…) wins over the locally saved plan.
  useEffect(() => {
    const shared = searchParams.get("plan");
    const fromLink = shared ? decodePlan(shared) : null;
    const initial = fromLink && fromLink.program === program.slug ? fromLink : loadPlan(program.slug);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser-only storage once
    setState(initial);
    setLoaded(true);
    if (fromLink) router.replace(pathname, { scroll: false });
  }, [program.slug, searchParams, router, pathname]);

  const update = useCallback((next: PlanState | ((s: PlanState) => PlanState)) => {
    setState((prev) => {
      if (!prev) return prev;
      const value = typeof next === "function" ? next(prev) : next;
      savePlan(value);
      return value;
    });
  }, []);

  // Fetch card data for modules that were added later (search results, shared plans).
  useEffect(() => {
    if (!state) return;
    const missing = [
      ...new Set(Object.values(state.semesters).flatMap((items) => items.map((i) => i.moduleCode).filter(Boolean))),
    ].filter((c) => !infos[c!]) as string[];
    if (missing.length === 0) return;
    fetch(`/api/planner/modules?codes=${missing.join(",")}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: PlannerModuleInfo[]) => setInfos((prev) => ({ ...prev, ...Object.fromEntries(list.map((m) => [m.code, m])) })))
      .catch(() => {});
  }, [state, infos]);

  const studyPlan = useMemo(() => plans.find((p) => p.id === state?.studyPlanId) ?? plans[0], [plans, state?.studyPlanId]);

  if (!loaded) return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Loading your plan…</div>;

  if (!state) {
    return (
      <SetupScreen
        program={program}
        plans={plans}
        planningSemester={planningSemester}
        onCreate={(start) => {
          const plan = studyPlanFor(plans, start)!;
          const created = createPlan(program.slug, plan, start);
          savePlan(created);
          setState(created);
        }}
      />
    );
  }

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

  const share = async () => {
    const url = `${window.location.origin}${pathname}?plan=${encodePlan(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/planner" className="text-xs/relaxed text-muted-foreground hover:text-foreground">
            ← All programs
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            {program.degree} {program.nameEn}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Started {termLabel(state.startSemester, 1)} · {studyPlan.title}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={share}>
            {copied ? <Check /> : <Link2 />} {copied ? "Link copied" : "Share plan"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              if (window.confirm("Reset to the recommended study plan? Your changes will be lost.")) {
                update(createPlan(program.slug, studyPlan, state.startSemester));
              }
            }}
          >
            <RotateCcw /> Reset
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              if (window.confirm("Delete this plan and choose a different start semester?")) {
                try {
                  window.localStorage.removeItem(storageKey(program.slug));
                } catch {}
                setState(null);
              }
            }}
          >
            Change start
          </Button>
        </div>
      </header>

      <ProgressPanel progress={progress} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {semesterNumbers.map((n) => (
          <SemesterColumn
            key={n}
            number={n}
            term={termOf(state.startSemester, n)}
            items={state.semesters[n] ?? []}
            infos={infos}
            areaOptions={areaOptions}
            isPlanningTerm={termOf(state.startSemester, n) === planningSemester}
            timetableHref={`/timetable?semester=${termOf(state.startSemester, n)}&modules=${(state.semesters[n] ?? [])
              .map((i) => i.moduleCode)
              .filter(Boolean)
              .join(",")}`}
            canMoveLeft={n > 1}
            canMoveRight={n < semesterNumbers.length}
            onMove={(id, dir) => update((s) => moveItem(s, id, n + dir))}
            onDrop={(id) => update((s) => moveItem(s, id, n))}
            onRemove={(id) => update((s) => removeItem(s, id))}
            onFill={(id, hit) =>
              update((s) => fillPlaceholder(s, id, { code: hit.code, title: hit.nameEn ?? hit.nameDe ?? hit.code, credits: hit.ects ?? 5 }))
            }
            onAdd={(hit, area) =>
              update((s) =>
                addItem(s, n, {
                  id: newItemId(),
                  kind: "module",
                  moduleCode: hit.code,
                  title: hit.nameEn ?? hit.nameDe ?? hit.code,
                  credits: hit.ects ?? 5,
                  area,
                }),
              )
            }
          />
        ))}
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-xs/relaxed text-muted-foreground">
          <Button variant="outline" onClick={() => update(addSemester)}>
            <Plus /> Add semester
          </Button>
          {semesterNumbers.length > 6 && (
            <Button variant="ghost" size="sm" onClick={() => update(removeLastSemester)}>
              Remove last empty semester
            </Button>
          )}
        </div>
      </div>

      {studyPlan.footnotes.length > 0 && (
        <details className="mt-8 rounded-lg bg-muted/50 p-4 text-xs/relaxed text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Notes from the official study plan</summary>
          <ul className="mt-2 space-y-1.5">
            {studyPlan.footnotes.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {program.sourceUrl && (
            <a href={program.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-primary hover:underline">
              Source: TUM School of CIT →
            </a>
          )}
        </details>
      )}
      <p className="mt-4 text-xs/relaxed text-muted-foreground">
        Your plan is saved in this browser only. Use “Share plan” to open it on another device. Unofficial — always check
        your FPSO and TUMonline.
      </p>
    </div>
  );
}

function SetupScreen({
  program,
  plans,
  planningSemester,
  onCreate,
}: {
  program: ProgramInfo;
  plans: StudyPlanData[];
  planningSemester: Semester;
  onCreate: (start: Semester) => void;
}) {
  const options = startOptions(planningSemester);
  const [start, setStart] = useState<Semester>(planningSemester);
  const plan = studyPlanFor(plans, start);
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Link href="/planner" className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← All programs
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {program.degree} {program.nameEn}
      </h1>
      <p className="mt-2 text-muted-foreground">When did (or will) you start your studies?</p>
      <Card className="mt-6">
        <CardContent className="space-y-4">
          <label className="flex flex-col gap-1 text-xs/relaxed font-medium text-muted-foreground">
            First semester
            <select
              value={start}
              onChange={(e) => setStart(e.target.value as Semester)}
              className="h-8 rounded-md border border-input bg-input/20 px-2 text-sm text-foreground"
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  {termLabel(o, 1)}
                </option>
              ))}
            </select>
          </label>
          {plan && <p className="text-xs/relaxed text-muted-foreground">Recommended plan: {plan.title}</p>}
          <Button size="lg" className="w-full" onClick={() => onCreate(start)}>
            Create my plan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full", value >= max ? "bg-primary" : "bg-primary/60")} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ProgressPanel({ progress }: { progress: ReturnType<typeof computeProgress> }) {
  const { requiredModules: req } = progress;
  return (
    <section className="mt-6 grid gap-3 rounded-lg bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <div className="flex items-baseline justify-between text-xs/relaxed">
          <span className="font-medium">Total credits</span>
          <span className="tabular-nums text-muted-foreground">
            {progress.totalCredits} / {BACHELOR_CREDITS}
          </span>
        </div>
        <ProgressBar value={progress.totalCredits} max={BACHELOR_CREDITS} className="mt-1.5" />
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">
          {progress.concreteCredits} ECTS in chosen modules, rest in open slots
        </p>
      </div>
      <div>
        <div className="flex items-baseline justify-between text-xs/relaxed">
          <span className="font-medium">Required modules</span>
          <span className="tabular-nums text-muted-foreground">
            {req.planned} / {req.total}
          </span>
        </div>
        <ProgressBar value={req.planned} max={req.total} className="mt-1.5" />
        {req.missing.length > 0 && (
          <p className="mt-1 text-[0.6875rem] text-destructive">Missing: {req.missing.join(", ")}</p>
        )}
      </div>
      {progress.requirements.map((r) => (
        <div key={r.area}>
          <div className="flex items-baseline justify-between gap-2 text-xs/relaxed">
            <span className="truncate font-medium" title={r.area}>
              {r.area}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {r.planned} / {r.required} ECTS
            </span>
          </div>
          <ProgressBar value={r.planned} max={r.required} className="mt-1.5" />
        </div>
      ))}
    </section>
  );
}

type SearchHit = { code: string; nameEn: string | null; nameDe: string | null; ects: number | null };

function SemesterColumn({
  number,
  term,
  items,
  infos,
  areaOptions,
  isPlanningTerm,
  timetableHref,
  canMoveLeft,
  canMoveRight,
  onMove,
  onDrop,
  onRemove,
  onFill,
  onAdd,
}: {
  number: number;
  term: Semester;
  items: PlannedItem[];
  infos: Record<string, PlannerModuleInfo>;
  areaOptions: string[];
  isPlanningTerm: boolean;
  timetableHref: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMove: (id: string, dir: -1 | 1) => void;
  onDrop: (id: string) => void;
  onRemove: (id: string) => void;
  onFill: (id: string, hit: SearchHit) => void;
  onAdd: (hit: SearchHit, area: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [area, setArea] = useState<string>(areaOptions[0] ?? "");
  const [dragOver, setDragOver] = useState(false);
  const credits = semesterCredits(items);

  return (
    <Card
      className={cn("gap-3 transition-shadow", dragOver && "ring-2 ring-primary/60")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("text/plan-item");
        if (id) onDrop(id);
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          Semester {number}
          <span className="font-normal text-muted-foreground">· {termLabel(term, 1)}</span>
        </CardTitle>
        <span
          className={cn(
            "text-xs/relaxed tabular-nums",
            credits > 36 ? "text-destructive" : credits < 20 && items.length ? "text-muted-foreground" : "",
          )}
        >
          {credits} ECTS
        </span>
      </CardHeader>
      <CardContent className="space-y-1.5">
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
            onFill={(hit) => onFill(item.id, hit)}
          />
        ))}
        {items.length === 0 && <p className="py-3 text-center text-xs/relaxed text-muted-foreground">Drop modules here</p>}

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
            {isPlanningTerm && items.some((i) => i.moduleCode) && (
              <Link href={timetableHref} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                <CalendarDays /> Timetable
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
  onFill,
}: {
  item: PlannedItem;
  info?: PlannerModuleInfo;
  term: Semester;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onFill: (hit: SearchHit) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const warning = info ? cycleWarning(info.cycle, term) : null;
  const isPlaceholder = item.kind === "placeholder";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plan-item", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group/item rounded-md p-2 text-xs/relaxed ring-1 transition-colors",
        isPlaceholder ? "border border-dashed border-primary/40 bg-primary/5 ring-transparent" : "bg-background ring-foreground/10",
        "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {isPlaceholder ? (
            <div className="font-medium text-primary">{item.title}</div>
          ) : (
            <Link href={`/modules/${encodeURIComponent(item.moduleCode!)}`} className="block hover:underline">
              <span className="font-mono text-[0.6875rem] text-muted-foreground">{item.moduleCode}</span>{" "}
              <span className="font-medium">{info?.nameEn ?? item.title}</span>
            </Link>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-muted-foreground">
            <span className="tabular-nums">{item.credits} ECTS</span>
            {item.area && !isPlaceholder && <Badge variant="outline">{item.area}</Badge>}
            {info?.stats && (
              <span title={`Latest exam: ${info.stats.semester}`} className="tabular-nums">
                Ø {formatAverage(info.stats.averageTotal)} · {formatPercent(info.stats.failureRate, 0)} failed
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
          <Button variant="ghost" size="icon-xs" disabled={!canMoveLeft} onClick={() => onMove(-1)} aria-label="Move to previous semester">
            <ArrowLeft />
          </Button>
          <Button variant="ghost" size="icon-xs" disabled={!canMoveRight} onClick={() => onMove(1)} aria-label="Move to next semester">
            <ArrowRight />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label="Remove">
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
          <Button variant="link" size="xs" className="mt-1 px-0" onClick={() => setChoosing(true)}>
            Choose module →
          </Button>
        ))}
    </div>
  );
}
