"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { previewUpload, submitUpload, type PreviewState, type SubmitState } from "@/lib/contribute/actions";
import { extractStatisticsBlock } from "@/lib/contribute/extract";
import { formatAverage, formatPercent } from "@/lib/format";
import { toDistribution } from "@/lib/stats/distribution";
import { formatSemester, type Semester } from "@/lib/stats/semester";

const NOT_FOUND =
  "This file doesn't contain the exam statistics. Make sure the chart was visible before saving, and save as “Webpage, complete” — or paste the HTML instead.";

export function UploadForm() {
  const [fragment, setFragment] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<PreviewState, { ok: true }> | null>(null);
  const [type, setType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitState | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFragment(null);
    setPreview(null);
    setType("");
    setError(null);
    setResult(null);
  }

  function handleHtml(html: string) {
    reset();
    // Only the statistics block is sent; the rest of the page (incl. your name) stays in the browser.
    const block = extractStatisticsBlock(html);
    if (!block) {
      setError(NOT_FOUND);
      return;
    }
    startTransition(async () => {
      const res = await previewUpload(block);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFragment(block);
      setPreview(res);
      setType(res.typeGuess === "retake" ? "retake" : "");
    });
  }

  function submit() {
    if (!fragment) return;
    startTransition(async () => {
      const res = await submitUpload(fragment, type);
      if (res.ok) {
        setResult(res);
        setPreview(null);
        setFragment(null);
      } else setError(res.error ?? "Upload failed.");
    });
  }

  if (result?.ok) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{result.message}</p>
        <Button variant="outline" onClick={reset}>
          Upload another exam
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!preview && (
        <>
          <Label>
            Saved TUMonline page (.html)
            <input
              type="file"
              accept=".html,.htm,text/html"
              disabled={pending}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) handleHtml(await file.text());
                e.target.value = "";
              }}
              className="block w-full text-sm file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:text-sm file:font-medium file:text-primary-foreground"
            />
          </Label>
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => setShowPaste((v) => !v)}
          >
            {showPaste ? "Hide" : "Saving doesn't work? Paste the HTML instead"}
          </button>
          {showPaste && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleHtml(String(new FormData(e.currentTarget).get("html") ?? ""));
              }}
            >
              <p className="text-xs/relaxed text-muted-foreground">
                On the statistics page, open the developer tools (<kbd>F12</kbd>), right-click the{" "}
                <code>&lt;html&gt;</code> element → Copy → Copy outerHTML (Chrome: “Copy element”), and paste it here.
              </p>
              <Textarea name="html" rows={5} placeholder="<html>…" className="font-mono text-xs" />
              <Button type="submit" variant="outline" disabled={pending}>
                Read pasted HTML
              </Button>
            </form>
          )}
          {pending && <p className="text-sm text-muted-foreground">Reading the statistics…</p>}
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {preview && <PreviewCard preview={preview} />}

      {preview && (
        <div className="space-y-3 border-t pt-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Which exam is this?</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {[
                { value: "endterm", label: "End-of-term exam (Endterm)" },
                { value: "retake", label: "Retake (Wiederholung)" },
              ].map((o) => (
                <label key={o.value} className="flex items-center gap-2">
                  <input type="radio" name="type" value={o.value} checked={type === o.value} onChange={() => setType(o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={pending || !type}>
              {pending ? "Sending…" : "Send for review"}
            </Button>
            <Button variant="outline" onClick={reset} disabled={pending}>
              Cancel
            </Button>
          </div>
          <p className="text-xs/relaxed text-muted-foreground">
            Only the numbers shown above are sent and stored.
          </p>
        </div>
      )}
    </div>
  );
}

function PreviewCard({ preview }: { preview: Extract<PreviewState, { ok: true }> }) {
  const { record, examCode, warnings, comparison } = preview;
  const bins = toDistribution(record.grades);
  const max = Math.max(1, ...bins.map((b) => b.count));
  const facts = [
    ["Registered", record.registered],
    ["Attempted", record.attempted],
    ["No-shows", record.noShow],
    ["Withdrawn", record.withdrawn],
    ["Average", record.averageTotal !== undefined ? formatAverage(record.averageTotal) : undefined],
    ["Failure rate", record.failureRate !== undefined ? formatPercent(record.failureRate) : undefined],
  ].filter(([, v]) => v !== undefined && v !== null) as [string, string | number][];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {record.moduleCode}
          </Badge>
          <span className="text-xs text-muted-foreground">exam {examCode}</span>
        </div>
        <h2 className="mt-1 text-lg font-semibold">{record.moduleName ?? record.moduleCode}</h2>
        <p className="text-sm text-muted-foreground">{formatSemester(record.semester as Semester)}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2 border-b border-dashed py-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex h-28 items-end gap-1" aria-label="Grade distribution">
        {bins.map((b) => (
          <div key={b.grade} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[0.625rem] text-muted-foreground tabular-nums">{b.count}</span>
            <div
              className={b.passing ? "w-full rounded-t bg-chart-1" : "w-full rounded-t bg-chart-fail"}
              style={{ height: `${(b.count / max) * 72}px` }}
            />
            <span className="text-[0.625rem] text-muted-foreground">{b.grade}</span>
          </div>
        ))}
      </div>

      {comparison.state === "same" && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">We already show exactly these numbers for this exam.</p>
      )}
      {comparison.state === "different" && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          We show different numbers for this exam — your upload helps us correct them.
        </p>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm">
          <p className="font-medium">Some numbers on the page don&apos;t add up:</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground">You can still send it; we&apos;ll check it by hand.</p>
        </div>
      )}
    </div>
  );
}
