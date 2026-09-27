import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { reviewSubmission } from "@/lib/contribute/actions";
import { listPendingSubmissions, listRecentlyReviewed } from "@/lib/contribute/submissions";
import { formatAverage, formatPercent } from "@/lib/format";
import { toDistribution } from "@/lib/stats/distribution";
import { formatSemester, type Semester } from "@/lib/stats/semester";

export const metadata: Metadata = { title: "Uploads · Admin", robots: { index: false } };

const selectClass =
  "h-9 rounded-md border border-input bg-input/20 px-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30";

export default async function AdminSubmissionsPage() {
  await requireAdmin("/admin/submissions");
  const [pending, reviewed] = await Promise.all([listPendingSubmissions(db), listRecentlyReviewed(db)]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← Admin
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Statistics uploads ({pending.length} pending)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Approving publishes the numbers as source “upload” and re-merges the module. If they disagree with another
        source, the exam is marked as a conflict until you pin a source.
      </p>

      <div className="mt-6 space-y-4">
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review.</p>}
        {pending.map((s) => {
          const r = s.record;
          const bins = toDistribution(r.grades);
          return (
            <Card key={s.id} size="sm">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    {s.moduleCode}
                  </Badge>
                  {r.moduleName}
                </CardTitle>
                <CardDescription>
                  {formatSemester(s.semester as Semester)} · {s.type} · uploaded {s.createdAt.toLocaleDateString("en-GB")} ·
                  parser {s.parserVersion}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="tabular-nums text-muted-foreground">
                  Registered {r.registered ?? "–"} · attempted {r.attempted ?? "–"} · no-show {r.noShow ?? "–"} · withdrawn{" "}
                  {r.withdrawn ?? "–"} · cheating {r.cheating ?? "–"} · average {formatAverage(r.averageTotal)} · failed{" "}
                  {formatPercent(r.failureRate)}
                </p>
                <p className="font-mono text-xs/relaxed">
                  {bins.map((b) => `${b.grade}: ${b.count}`).join(" · ")}
                </p>
                {s.comparison.state === "none" && <Badge variant="outline">new exam</Badge>}
                {s.comparison.state === "same" && (
                  <Badge variant="outline">matches published data ({s.comparison.sources.join(", ")})</Badge>
                )}
                {s.comparison.state === "different" && (
                  <Badge variant="destructive">
                    differs from published data ({s.comparison.sources.join(", ")}, {s.comparison.attempted ?? "?"} attempts)
                  </Badge>
                )}
                {s.warnings.length > 0 && (
                  <ul className="list-disc pl-5 text-amber-700 dark:text-amber-400">
                    {s.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                <form action={reviewSubmission} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="submissionId" value={s.id} />
                  <input type="hidden" name="moduleCode" value={s.moduleCode} />
                  <select name="type" defaultValue={s.type} className={selectClass} aria-label="Exam type">
                    <option value="endterm">endterm</option>
                    <option value="retake">retake</option>
                  </select>
                  <Button type="submit" name="decision" value="approve">
                    Approve
                  </Button>
                  <Input name="note" placeholder="Reason (optional)" className="w-48" />
                  <Button type="submit" name="decision" value="reject" variant="outline">
                    Reject
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {reviewed.length > 0 && (
        <>
          <h2 className="mt-10 text-sm font-semibold text-muted-foreground">Recently reviewed</h2>
          <ul className="mt-2 space-y-1 text-xs/relaxed text-muted-foreground">
            {reviewed.map((s) => (
              <li key={s.id}>
                <Link href={`/modules/${s.moduleCode}`} className="hover:underline">
                  {s.moduleCode}
                </Link>{" "}
                {s.semester} {s.type}: <strong>{s.status}</strong>
                {s.reviewNote ? ` — ${s.reviewNote}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
