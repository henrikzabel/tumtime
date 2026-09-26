import { DAY_NAMES, formatMinutes, formatSlot } from "@/lib/planner/timetable";
import type { CalendarBlock } from "@/lib/schedule/selection";
import { cn } from "@/lib/utils";

const DAY_START = 8 * 60;
const DAY_END = 20 * 60;
const HOUR_PX = 44;

/** Monday–Friday grid; overlapping blocks share the column width. */
export function WeekGrid({
  blocks,
  compact = false,
}: {
  blocks: CalendarBlock[];
  compact?: boolean;
}) {
  const hasWeekend = blocks.some((b) => b.slot.weekday > 5);
  const days = hasWeekend ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const start = Math.min(
    DAY_START,
    ...blocks.map((b) => Math.floor(b.slot.startMinutes / 60) * 60),
  );
  const end = Math.max(
    DAY_END,
    ...blocks.map((b) => Math.ceil(b.slot.endMinutes / 60) * 60),
  );
  const hours = Array.from(
    { length: (end - start) / 60 },
    (_, i) => start / 60 + i,
  );
  const hourPx = compact ? 30 : HOUR_PX;
  const top = (m: number) => ((m - start) / 60) * hourPx;

  return (
    <div
      className={cn(
        "h-fit overflow-x-auto rounded-lg bg-card ring-1 ring-foreground/10",
        !compact && "lg:sticky lg:top-16",
      )}
    >
      <div
        className={cn("grid", compact ? "min-w-[28rem]" : "min-w-[40rem]")}
        style={{
          gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))`,
        }}
      >
        <div />
        {days.map((d) => (
          <div
            key={d}
            className="border-b py-2 text-center text-xs/relaxed font-medium"
          >
            {DAY_NAMES[d]}
          </div>
        ))}
        <div className="relative" style={{ height: hours.length * hourPx }}>
          {hours.map((h) => (
            <div
              key={h}
              className="absolute right-1 text-[0.625rem] text-muted-foreground tabular-nums"
              style={{ top: top(h * 60) - 6 }}
            >
              {formatMinutes(h * 60)}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dayBlocks = blocks
            .filter((b) => b.slot.weekday === d)
            .sort((a, b) => a.slot.startMinutes - b.slot.startMinutes);
          const lanes: number[] = [];
          const laneOf = new Map<string, number>();
          for (const b of dayBlocks) {
            let lane = lanes.findIndex(
              (endMin) => endMin <= b.slot.startMinutes,
            );
            if (lane === -1) lane = lanes.length;
            lanes[lane] = b.slot.endMinutes;
            laneOf.set(b.key, lane);
          }
          const laneCount = Math.max(1, lanes.length);
          return (
            <div
              key={d}
              className="relative border-l"
              style={{ height: hours.length * hourPx }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: top(h * 60) }}
                />
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
                      height: Math.max(
                        18,
                        top(b.slot.endMinutes) - top(b.slot.startMinutes) - 2,
                      ),
                      left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                      width: `calc(${100 / laneCount}% - 4px)`,
                      background: b.color,
                    }}
                  >
                    <div className="font-semibold">{b.title}</div>
                    <div className="opacity-90">
                      {formatMinutes(b.slot.startMinutes)}–
                      {formatMinutes(b.slot.endMinutes)} {b.label}
                    </div>
                    {b.slot.room && (
                      <div className="opacity-90">{b.slot.room}</div>
                    )}
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
