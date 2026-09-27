import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { moderateComment } from "@/lib/reviews/actions";
import { listPendingComments } from "@/lib/reviews/reviews";
import { formatSemesterShort, type Semester } from "@/lib/stats/semester";

export const metadata: Metadata = { title: "Review comments · Admin", robots: { index: false } };

export default async function AdminReviewsPage() {
  await requireAdmin("/admin/reviews");
  const pending = await listPendingComments(db);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← Admin
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Review comments ({pending.length} pending)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ratings are live already; only the written comment waits for approval. Reject comments that name or attack
        individuals, contain personal data, or are off-topic.
      </p>
      <div className="mt-6 space-y-3">
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review.</p>}
        {pending.map((r) => (
          <Card key={r.id} size="sm">
            <CardHeader>
              <CardTitle>
                <Link href={`/modules/${r.moduleCode}`} className="hover:underline">
                  {r.moduleCode} {r.moduleName}
                </Link>
              </CardTitle>
              <CardDescription>
                Taken {formatSemesterShort(r.semester as Semester)} · written {r.updatedAt.toLocaleDateString("en-GB")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm whitespace-pre-line">{r.comment}</p>
              <form action={moderateComment} className="flex gap-2">
                <input type="hidden" name="reviewId" value={r.id} />
                <Button type="submit" name="decision" value="approve">
                  Approve
                </Button>
                <Button type="submit" name="decision" value="reject" variant="outline">
                  Reject
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
