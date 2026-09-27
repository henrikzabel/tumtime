import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { applications, clubForms, clubs } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import type { FormField } from "@/lib/clubs/forms";

import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Apply", robots: { index: false } };

export default async function ApplyPage({ params }: PageProps<"/clubs/[slug]/apply/[formId]">) {
  const { slug, formId } = await params;
  const user = await requireUser(`/clubs/${slug}/apply/${formId}`);
  const [row] = await db
    .select({ form: clubForms, club: clubs })
    .from(clubForms)
    .innerJoin(clubs, eq(clubs.id, clubForms.clubId))
    .where(and(eq(clubForms.id, Number(formId) || 0), eq(clubs.slug, slug)));
  if (!row || row.form.status === "draft") notFound();
  const open = row.form.status === "open" && (!row.form.closesAt || row.form.closesAt > new Date());
  const [existing] = await db
    .select({ status: applications.status })
    .from(applications)
    .where(and(eq(applications.formId, row.form.id), eq(applications.userId, user.id)));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-10">
      <Link href={`/clubs/${slug}`} className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← {row.club.name}
      </Link>
      <Card className="mt-3">
        <CardHeader>
          <CardDescription>{row.club.name}</CardDescription>
          <CardTitle className="text-lg">{row.form.title}</CardTitle>
          {row.form.intro && <CardDescription className="whitespace-pre-line">{row.form.intro}</CardDescription>}
        </CardHeader>
        <CardContent>
          {existing ? (
            <p className="text-sm">
              You already applied with this form.{" "}
              <Link href="/me" className="text-primary underline-offset-4 hover:underline">
                See its status in your account
              </Link>
              .
            </p>
          ) : !open ? (
            <p className="text-sm text-muted-foreground">This form is no longer accepting applications.</p>
          ) : (
            <ApplyForm
              slug={slug}
              formId={row.form.id}
              clubName={row.club.name}
              fields={row.form.fields as FormField[]}
              defaultName={user.name ?? ""}
              email={user.email}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
