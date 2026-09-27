import Link from "next/link";
import { PenLine } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { RATING_METRICS } from "@/lib/reviews/metrics";
import type { ReviewSummary } from "@/lib/reviews/reviews";
import { formatSemesterShort, type Semester } from "@/lib/stats/semester";
import { cn } from "@/lib/utils";

const short = (s: string) => formatSemesterShort(s as Semester);

function Meter({ value }: { value: number | null }) {
  return (
    <div className="mt-2 flex gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full",
            value !== null && i <= Math.round(value) ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function share({ yes, answered }: { yes: number; answered: number }) {
  return answered ? `${Math.round((yes / answered) * 100)}%` : "–";
}

/** Berkeleytime-style ratings: averages of 1–5 scales, yes/no shares and approved comments. */
export function ModuleReviews({
  code,
  summary,
  semester,
  filterHref,
}: {
  code: string;
  summary: ReviewSummary;
  semester?: string;
  filterHref: (semester?: string) => string;
}) {
  const writeHref = `/modules/${encodeURIComponent(code)}/review`;
  return (
    <section aria-labelledby="reviews-heading" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="reviews-heading" className="text-xl font-semibold tracking-tight">
            Student reviews
          </h2>
          <p className="text-sm text-muted-foreground">
            {summary.count === 0
              ? semester
                ? `No reviews for ${short(semester)}.`
                : "No reviews yet — be the first."
              : `Based on ${summary.count} review${summary.count === 1 ? "" : "s"}${semester ? ` from ${short(semester)}` : ""}.`}
          </p>
        </div>
        <Link href={writeHref} className={buttonVariants({ variant: "outline" })}>
          <PenLine /> Write a review
        </Link>
      </div>

      {summary.semesters.length > 1 && (
        <nav aria-label="Review semester" className="mt-3 flex flex-wrap gap-1 text-sm">
          {[undefined, ...summary.semesters].map((s) => (
            <Link
              key={s ?? "all"}
              href={filterHref(s)}
              scroll={false}
              aria-current={s === semester ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors hover:bg-muted",
                s === semester ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {s ? short(s) : "All semesters"}
            </Link>
          ))}
        </nav>
      )}

      {summary.count > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {RATING_METRICS.map((m) => (
            <div key={m.key} className="rounded-lg bg-card p-4 ring-1 ring-foreground/10">
              <div className="text-sm font-medium text-muted-foreground">{m.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {summary.averages[m.key]?.toFixed(1) ?? "–"}
                <span className="text-sm font-normal text-muted-foreground"> / 5</span>
              </div>
              <Meter value={summary.averages[m.key]} />
              <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground">
                <span>{m.low}</span>
                <span>{m.high}</span>
              </div>
            </div>
          ))}
          <div className="rounded-lg bg-card p-4 ring-1 ring-foreground/10">
            <div className="text-sm font-medium text-muted-foreground">Attendance required</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{share(summary.attendanceRequired)}</div>
            <div className="mt-1 text-xs/relaxed text-muted-foreground">
              said yes ({summary.attendanceRequired.answered} answered)
            </div>
          </div>
          <div className="rounded-lg bg-card p-4 ring-1 ring-foreground/10">
            <div className="text-sm font-medium text-muted-foreground">Lectures recorded</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{share(summary.lecturesRecorded)}</div>
            <div className="mt-1 text-xs/relaxed text-muted-foreground">
              said yes ({summary.lecturesRecorded.answered} answered)
            </div>
          </div>
        </div>
      )}

      {summary.comments.length > 0 && (
        <ul className="mt-6 space-y-3">
          {summary.comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{short(c.semester)}</span>
                <span>Usefulness {c.usefulness}/5</span>
                <span>Difficulty {c.difficulty}/5</span>
                <span>Workload {c.workload}/5</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{c.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
