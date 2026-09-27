import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { modules } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getMyReviews, recentSemesters } from "@/lib/reviews/reviews";

import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Write a review", robots: { index: false } };

export default async function ReviewPage({ params }: PageProps<"/modules/[code]/review">) {
  const code = decodeURIComponent((await params).code).toUpperCase();
  const user = await requireUser(`/modules/${code}/review`);
  const [mod] = await db
    .select({ id: modules.id, code: modules.code, nameEn: modules.nameEn, nameDe: modules.nameDe })
    .from(modules)
    .where(eq(modules.code, code));
  if (!mod) notFound();
  const mine = await getMyReviews(db, user.id, mod.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/modules/${mod.code}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {mod.code} {mod.nameEn ?? mod.nameDe}
      </Link>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="text-lg">Review {mod.nameEn ?? mod.nameDe ?? mod.code}</CardTitle>
          <CardDescription>
            Your ratings are shown only as averages, and never with your name or e-mail address. A written comment
            appears anonymously once we&apos;ve checked it. Please don&apos;t name or judge individual people.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewForm
            moduleCode={mod.code}
            semesters={recentSemesters()}
            existing={mine.map((r) => ({
              id: r.id,
              semester: r.semester,
              usefulness: r.usefulness,
              difficulty: r.difficulty,
              workload: r.workload,
              attendanceRequired: r.attendanceRequired,
              lecturesRecorded: r.lecturesRecorded,
              comment: r.comment,
              commentStatus: r.commentStatus,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
