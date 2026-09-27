"use client";

import { useState } from "react";

import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { removeReview, submitReview } from "@/lib/reviews/actions";
import { COMMENT_MAX, RATING_METRICS } from "@/lib/reviews/metrics";
import { formatSemester, type Semester } from "@/lib/stats/semester";
import { cn } from "@/lib/utils";

type Existing = {
  id: number;
  semester: string;
  usefulness: number;
  difficulty: number;
  workload: number;
  attendanceRequired: boolean | null;
  lecturesRecorded: boolean | null;
  comment: string | null;
  commentStatus: string | null;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-input/20 px-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30";

const COMMENT_STATUS: Record<string, string> = {
  pending: "Your comment is waiting for review.",
  approved: "Your comment is published.",
  rejected: "Your comment was not published. You can edit it and send it again.",
};

function Scale({ name, label, low, high, value }: { name: string; label: string; low: string; high: string; value?: number }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} defaultChecked={value === n} className="peer sr-only" />
            <span className="grid h-10 place-items-center rounded-md text-sm font-medium ring-1 ring-foreground/15 transition-colors peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:ring-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:bg-muted">
              {n}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}

function YesNo({ name, label, value }: { name: string; label: string; value: boolean | null | undefined }) {
  const current = value === true ? "yes" : value === false ? "no" : "";
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-1.5">
        {[
          { v: "yes", l: "Yes" },
          { v: "no", l: "No" },
          { v: "", l: "Not sure" },
        ].map((o) => (
          <label key={o.v} className="cursor-pointer">
            <input type="radio" name={name} value={o.v} defaultChecked={current === o.v} className="peer sr-only" />
            <span
              className={cn(
                "inline-flex h-9 items-center rounded-md px-3 text-sm ring-1 ring-foreground/15 transition-colors hover:bg-muted",
                "peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:ring-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
              )}
            >
              {o.l}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewForm({ moduleCode, semesters, existing }: { moduleCode: string; semesters: Semester[]; existing: Existing[] }) {
  const [semester, setSemester] = useState<string>(existing.find((e) => semesters.includes(e.semester as Semester))?.semester ?? "");
  const current = existing.find((e) => e.semester === semester);

  return (
    <div className="space-y-6">
      <ActionForm
        action={submitReview.bind(null, moduleCode)}
        submitLabel={current ? "Update review" : "Publish review"}
        pendingLabel="Saving…"
        className="space-y-5"
      >
        <Label>
          When did you take it?
          <select name="semester" value={semester} onChange={(e) => setSemester(e.target.value)} className={selectClass} required>
            <option value="" disabled>
              Choose a semester
            </option>
            {semesters.map((s) => (
              <option key={s} value={s}>
                {formatSemester(s)}
                {existing.some((e) => e.semester === s) ? " (reviewed)" : ""}
              </option>
            ))}
          </select>
        </Label>
        {/* Remount the inputs when the semester changes so they show that semester's review. */}
        <div key={semester} className="space-y-5">
          {RATING_METRICS.map((m) => (
            <Scale key={m.key} name={m.key} label={m.label} low={m.low} high={m.high} value={current?.[m.key]} />
          ))}
          <div className="grid gap-5 sm:grid-cols-2">
            <YesNo name="attendanceRequired" label="Attendance required?" value={current?.attendanceRequired} />
            <YesNo name="lecturesRecorded" label="Lectures recorded?" value={current?.lecturesRecorded} />
          </div>
          <Label>
            Comment (optional)
            <Textarea
              name="comment"
              maxLength={COMMENT_MAX}
              rows={5}
              defaultValue={current?.comment ?? ""}
              placeholder="What should others know? Exam format, how to prepare, what the tutorials are like…"
            />
          </Label>
          {current?.commentStatus && <p className="text-xs text-muted-foreground">{COMMENT_STATUS[current.commentStatus]}</p>}
        </div>
      </ActionForm>

      {current && (
        <form action={removeReview} className="border-t pt-4">
          <input type="hidden" name="reviewId" value={current.id} />
          <input type="hidden" name="moduleCode" value={moduleCode} />
          <Button type="submit" variant="ghost" size="sm" className="text-destructive">
            Delete my review for {formatSemester(current.semester as Semester)}
          </Button>
        </form>
      )}
    </div>
  );
}
