import type { TimelineItem } from "@/lib/clubs/timeline";
import { cn } from "@/lib/utils";

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

function label(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return `${monthFmt.format(d)} ${ordinal(d.getUTCDate())}`;
}

/** Horizontal recruitment timeline: grey = passed, dark ring = next up, amber = deadline. */
export function RecruitmentTimeline({ items, term }: { items: TimelineItem[]; term?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
        Recruitment timeline {term && <span className="text-sm font-normal text-muted-foreground">{term}</span>}
      </h2>
      <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-2">
        <ol className="flex min-w-max">
          {items.map((it, i) => {
            const deadline = it.kind === "deadline";
            return (
              <li key={`${it.date}-${i}`} className="relative flex w-36 flex-col items-center text-center">
                {/* connector to the next milestone */}
                {i < items.length - 1 && <span aria-hidden className="absolute top-[0.6875rem] left-1/2 h-0.5 w-full bg-border" />}
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 size-[1.375rem] rounded-full border-4 border-background",
                    deadline ? "bg-[#f0b100]" : it.state === "next" ? "bg-foreground ring-2 ring-foreground/15" : "bg-muted-foreground/30",
                    it.state === "past" && "opacity-50",
                  )}
                />
                <span className={cn("mt-3 text-xs font-bold tracking-wide uppercase", it.state === "past" && "text-muted-foreground")}>
                  {label(it.date)}
                </span>
                <span
                  className={cn(
                    "mt-1.5 px-2 text-sm/snug text-balance",
                    it.state === "next" ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {it.title}
                  {it.state === "past" && <span className="sr-only"> (passed)</span>}
                </span>
                {it.lines.map((l) => (
                  <span key={l} className="mt-0.5 px-2 text-[0.6875rem] tracking-wide text-muted-foreground/80 uppercase">
                    {l}
                  </span>
                ))}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
