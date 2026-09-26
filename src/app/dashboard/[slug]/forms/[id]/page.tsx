import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { FormBuilder } from "@/components/clubs/form-builder";
import { db } from "@/db";
import { clubForms } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { defaultFields, type FormField } from "@/lib/clubs/forms";
import { getManagedClub } from "@/lib/clubs/queries";

export const metadata: Metadata = { title: "Edit sign-up form", robots: { index: false } };

export default async function FormEditorPage({ params, searchParams }: PageProps<"/dashboard/[slug]/forms/[id]">) {
  const { slug, id } = await params;
  const { saved } = await searchParams;
  const user = await requireUser(`/dashboard/${slug}/forms/${id}`);
  const club = await getManagedClub(slug, user);
  if (!club) notFound();

  let form: { id: number | null; title: string; intro: string; status: string; closesAt: string; fields: FormField[] } = {
    id: null,
    title: `Join ${club.name}`,
    intro: "",
    status: "draft",
    closesAt: "",
    fields: defaultFields(),
  };
  if (id !== "new") {
    const [row] = await db
      .select()
      .from(clubForms)
      .where(and(eq(clubForms.id, Number(id) || 0), eq(clubForms.clubId, club.id)));
    if (!row) notFound();
    form = {
      id: row.id,
      title: row.title,
      intro: row.intro ?? "",
      status: row.status,
      closesAt: row.closesAt ? row.closesAt.toISOString().slice(0, 10) : "",
      fields: row.fields as FormField[],
    };
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      <Link href={`/dashboard/${slug}`} className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← {club.name}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{form.id ? "Edit sign-up form" : "New sign-up form"}</h1>
      {saved && <p className="mt-2 text-xs/relaxed text-primary">Form created.</p>}
      <FormBuilder slug={slug} initial={form} />
    </div>
  );
}
