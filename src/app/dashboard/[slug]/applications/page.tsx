import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { updateApplication } from "@/lib/clubs/actions";
import { formatAnswer, type Answers, type FormField } from "@/lib/clubs/forms";
import { getClubApplications, getManagedClub } from "@/lib/clubs/queries";
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/clubs/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Applications", robots: { index: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const BADGE: Record<ApplicationStatus, "default" | "secondary" | "outline"> = {
  submitted: "default",
  in_review: "secondary",
  accepted: "outline",
  rejected: "outline",
};

export default async function ApplicationsPage({ params, searchParams }: PageProps<"/dashboard/[slug]/applications">) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/dashboard/${slug}/applications`);
  const club = await getManagedClub(slug, user);
  if (!club) notFound();
  const all = await getClubApplications(club.id);

  const formFilter = one(sp.form);
  const statusFilter = one(sp.status);
  const forms = [...new Map(all.map((a) => [a.formId, a.formTitle])).entries()];
  const list = all.filter(
    (a) => (!formFilter || String(a.formId) === formFilter) && (!statusFilter || a.status === statusFilter),
  );
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { form: formFilter, status: statusFilter, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/dashboard/${slug}/applications${qs ? `?${qs}` : ""}`;
  };
  const chip = (active: boolean) =>
    cn(
      "rounded-full px-2.5 py-0.5 text-xs/relaxed ring-1 transition-colors",
      active ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-muted-foreground ring-foreground/10 hover:text-foreground",
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      <Link href={`/dashboard/${slug}`} className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← {club.name}
      </Link>
      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <a href={`/dashboard/${slug}/applications/export${formFilter ? `?form=${formFilter}` : ""}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
          <Download /> Export CSV
        </a>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Link href={href({ form: undefined })} className={chip(!formFilter)}>
          All forms
        </Link>
        {forms.map(([id, title]) => (
          <Link key={id} href={href({ form: String(id) })} className={chip(formFilter === String(id))}>
            {title}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Link href={href({ status: undefined })} className={chip(!statusFilter)}>
          All ({all.length})
        </Link>
        {APPLICATION_STATUSES.map((s) => (
          <Link key={s} href={href({ status: s })} className={chip(statusFilter === s)}>
            {STATUS_LABELS[s]} ({all.filter((a) => a.status === s).length})
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {list.length === 0 && <p className="text-sm text-muted-foreground">No applications yet.</p>}
        {list.map((a) => {
          const fields = a.fields as FormField[];
          const answers = a.answers as Answers;
          return (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{a.applicantName}</CardTitle>
                  <Badge variant={BADGE[a.status as ApplicationStatus] ?? "outline"}>
                    {STATUS_LABELS[a.status as ApplicationStatus] ?? a.status}
                  </Badge>
                </div>
                <CardDescription>
                  <a href={`mailto:${a.applicantEmail}`} className="hover:underline">
                    {a.applicantEmail}
                  </a>{" "}
                  · {a.formTitle} · {a.createdAt.toLocaleDateString("en-GB")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="space-y-2">
                  {fields.map((f) => (
                    <div key={f.id}>
                      <dt className="text-xs/relaxed font-medium text-muted-foreground">{f.label}</dt>
                      <dd className="text-sm whitespace-pre-line break-words">
                        {f.type === "url" && typeof answers[f.id] === "string" && answers[f.id] ? (
                          <a href={String(answers[f.id])} target="_blank" rel="noreferrer nofollow" className="text-primary hover:underline">
                            {String(answers[f.id])}
                          </a>
                        ) : (
                          formatAnswer(f, answers[f.id])
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <form action={updateApplication.bind(null, slug)} className="grid gap-2 border-t pt-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-start">
                  <input type="hidden" name="applicationId" value={a.id} />
                  <div className="space-y-1.5">
                    <select
                      name="status"
                      defaultValue={a.status}
                      className="h-8 w-full rounded-md border border-input bg-input/20 px-2 text-sm"
                      aria-label="Status"
                    >
                      {APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                      <input type="checkbox" name="notify" defaultChecked className="accent-[var(--primary)]" />
                      E-mail applicant on change
                    </label>
                  </div>
                  <Textarea name="note" defaultValue={a.clubNote ?? ""} rows={2} className="min-h-8 text-xs" placeholder="Internal note (only your team sees this)" />
                  <Button type="submit">Save</Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
