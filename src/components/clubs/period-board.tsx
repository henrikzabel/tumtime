"use client";

import { AlertTriangle, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { moveSession } from "@/lib/clubs/info-session-actions";
import { cellKey, formatDay, weekStart, type Slot, type Venue } from "@/lib/clubs/info-sessions";
import { cn } from "@/lib/utils";

export type BoardClub = {
  clubId: number;
  name: string;
  focusAreas: string[];
  preferredDates: string[];
  avoidDates: string[];
  preferredTimes: string[];
  requested: boolean;
};

/**
 * Admin planning board: nights as columns, time slots as rows, one box per room. Select a club
 * (scheduled or not), then click a box to place, move or swap it.
 */
export function PeriodBoard({
  periodId,
  dates,
  slots,
  venues,
  placed,
  clubs,
  otherClubs,
}: {
  periodId: number;
  dates: string[];
  slots: Slot[];
  venues: Venue[];
  placed: Record<string, number>; // cellKey -> clubId
  clubs: BoardClub[];
  otherClubs: { clubId: number; name: string; focusAreas: string[] }[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = useMemo(
    () =>
      new Map<number, BoardClub>([
        ...otherClubs.map((c): [number, BoardClub] => [c.clubId, { ...c, preferredDates: [], avoidDates: [], preferredTimes: [], requested: false }]),
        ...clubs.map((c): [number, BoardClub] => [c.clubId, c]),
      ]),
    [clubs, otherClubs],
  );
  const cellOf = useMemo(() => new Map(Object.entries(placed).map(([k, id]) => [id, k])), [placed]);
  const unscheduled = clubs.filter((c) => c.requested && !cellOf.has(c.clubId));
  const sel = selected !== null ? byId.get(selected) ?? null : null;
  const weeks = [...new Set(dates.map(weekStart))].map((w) => dates.filter((d) => weekStart(d) === w));

  // Clubs sharing a focus area at the same date+time.
  const clashing = useMemo(() => {
    const out = new Set<number>();
    const groups = new Map<string, number[]>();
    for (const [key, id] of Object.entries(placed)) {
      const [date, time] = key.split("|");
      groups.set(`${date}|${time}`, [...(groups.get(`${date}|${time}`) ?? []), id]);
    }
    for (const ids of groups.values()) {
      for (const a of ids) for (const b of ids) {
        if (a !== b && byId.get(a)?.focusAreas.some((x) => byId.get(b)?.focusAreas.includes(x))) out.add(a);
      }
    }
    return out;
  }, [placed, byId]);

  function place(target: string | null) {
    if (selected === null) return;
    const id = selected;
    setError(null);
    start(async () => {
      const res = await moveSession(periodId, id, target);
      if (res.error) setError(res.error);
      else setSelected(null);
    });
  }

  function hint(date: string, start: string): "good" | "bad" | "clash" | null {
    if (!sel) return null;
    if (sel.avoidDates.includes(date)) return "bad";
    const parallel = venues.map((v) => placed[cellKey(date, start, v.name)]).filter((id) => id !== undefined && id !== sel.clubId);
    if (parallel.some((id) => byId.get(id)?.focusAreas.some((a) => sel.focusAreas.includes(a)))) return "clash";
    const okDate = !sel.preferredDates.length || sel.preferredDates.includes(date);
    const okTime = !sel.preferredTimes.length || sel.preferredTimes.includes(start);
    return okDate && okTime ? "good" : null;
  }

  return (
    <div className={cn("space-y-4", pending && "opacity-60")}>
      <div className="sticky top-12 z-10 flex min-h-10 flex-wrap items-center gap-2 rounded-md bg-background/95 p-2 text-xs/relaxed ring-1 ring-foreground/10 backdrop-blur">
        {sel ? (
          <>
            <span>
              Placing <strong>{sel.name}</strong> — click a room. Green = preferred, red = can&apos;t make it, amber = same topic in
              parallel.
            </span>
            {cellOf.has(sel.clubId) && (
              <Button size="sm" variant="outline" onClick={() => place(null)}>
                Unschedule
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" onClick={() => setSelected(null)} aria-label="Cancel">
              <X />
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">Select a club (below or in the grid) to place or move it.</span>
        )}
        {error && <span className="text-destructive">{error}</span>}
      </div>

      {weeks.map((week) => (
        <div key={week[0]} className="overflow-x-auto">
          <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-1 text-[0.6875rem]">
            <thead>
              <tr>
                <th className="w-14" />
                {week.map((d) => (
                  <th key={d} className="font-semibold">
                    {formatDay(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.start}>
                  <th className="align-top font-normal text-muted-foreground tabular-nums">
                    {s.start}
                    <br />
                    {s.end}
                  </th>
                  {week.map((d) => {
                    const h = hint(d, s.start);
                    return (
                      <td key={d} className="align-top">
                        <div className="space-y-1">
                          {venues.map((v) => {
                            const key = cellKey(d, s.start, v.name);
                            const id = placed[key];
                            const club = id !== undefined ? byId.get(id) : undefined;
                            return (
                              <button
                                key={v.name}
                                type="button"
                                disabled={pending}
                                onClick={() => (sel ? place(key) : id !== undefined && setSelected(id))}
                                className={cn(
                                  "flex h-9 w-full flex-col justify-center rounded border px-1.5 text-left transition-colors",
                                  club ? "bg-card" : "border-dashed text-muted-foreground",
                                  id !== undefined && id === selected && "border-primary ring-2 ring-primary/40",
                                  id !== undefined && clashing.has(id) && "border-[#f0b100] bg-[#f0b100]/10",
                                  h === "good" && "bg-primary/10",
                                  h === "bad" && "bg-destructive/10",
                                  h === "clash" && "bg-[#f0b100]/15",
                                  sel ? "cursor-pointer hover:border-primary" : club ? "cursor-pointer hover:bg-muted" : "cursor-default",
                                )}
                              >
                                <span className="truncate font-medium">{club?.name ?? (id !== undefined ? `#${id}` : "")}</span>
                                <span className="truncate text-[0.625rem] text-muted-foreground">{v.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {clashing.size > 0 && (
        <p className="flex items-center gap-1.5 text-xs/relaxed text-[#8a5d00] dark:text-[#f5c451]">
          <AlertTriangle className="size-3.5" /> {clashing.size} sessions run in parallel with a club of the same focus area.
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold">Requested but not scheduled ({unscheduled.length})</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unscheduled.map((c) => (
            <button
              key={c.clubId}
              type="button"
              onClick={() => setSelected(c.clubId === selected ? null : c.clubId)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs/relaxed transition-colors hover:bg-muted",
                selected === c.clubId && "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {c.name}
            </button>
          ))}
          {unscheduled.length === 0 && <span className="text-xs/relaxed text-muted-foreground">Everyone who asked has a slot.</span>}
        </div>
      </div>
      <label className="flex max-w-md flex-col gap-1 text-xs/relaxed font-medium">
        Add a club without a request
        <select
          className="h-8 rounded-md border border-input bg-input/20 px-2 text-sm font-normal"
          value=""
          onChange={(e) => e.target.value && setSelected(Number(e.target.value))}
        >
          <option value="">Choose a club…</option>
          {otherClubs.map((c) => (
            <option key={c.clubId} value={c.clubId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
