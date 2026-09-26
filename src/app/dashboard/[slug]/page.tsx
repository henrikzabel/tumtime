import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Inbox, Plus } from "lucide-react";

import { ActionForm } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { removeMember, updateClubProfile } from "@/lib/clubs/actions";
import { getClubDashboard, getManagedClub } from "@/lib/clubs/queries";

export const metadata: Metadata = { title: "Club dashboard", robots: { index: false } };

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = { open: "default", draft: "outline", closed: "secondary" };

export default async function ClubDashboardPage({ params }: PageProps<"/dashboard/[slug]">) {
  const { slug } = await params;
  const user = await requireUser(`/dashboard/${slug}`);
  const club = await getManagedClub(slug, user);
  if (!club) notFound();
  const { forms, members, counts } = await getClubDashboard(club.id);
  const total = counts.reduce((s, c) => s + c.n, 0);
  const fresh = counts.filter((c) => c.status === "submitted").reduce((s, c) => s + c.n, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      <Link href={`/clubs/${slug}`} className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← Public profile
      </Link>
      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{club.name}</h1>
        <Link href={`/dashboard/${slug}/applications`} className={buttonVariants({ size: "lg" })}>
          <Inbox /> Applications ({total}
          {fresh ? `, ${fresh} new` : ""})
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sign-up forms</CardTitle>
              <CardDescription>Build your own application form. Only open forms are visible to students.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {forms.map((f) => {
                const n = counts.filter((c) => c.formId === f.id).reduce((s, c) => s + c.n, 0);
                return (
                  <Link
                    key={f.id}
                    href={`/dashboard/${slug}/forms/${f.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-2 ring-1 ring-foreground/10 hover:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{f.title}</span>
                      <span className="text-[0.6875rem] text-muted-foreground">
                        {(f.fields as unknown[]).length} questions · {n} applications
                        {f.closesAt ? ` · closes ${f.closesAt.toLocaleDateString("en-GB")}` : ""}
                      </span>
                    </span>
                    <Badge variant={STATUS_BADGE[f.status] ?? "outline"}>{f.status}</Badge>
                  </Link>
                );
              })}
              <Link href={`/dashboard/${slug}/forms/new`} className={buttonVariants({ variant: "outline" })}>
                <Plus /> New form
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Club profile</CardTitle>
              <CardDescription>Shown on your public page instead of the TUM gallery text.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm action={updateClubProfile.bind(null, slug)} submitLabel="Save profile">
                <Label>
                  Description
                  <Textarea
                    name="description"
                    rows={8}
                    maxLength={5000}
                    defaultValue={club.description ?? club.sourceDescription ?? ""}
                  />
                </Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Label>
                    Website
                    <Input name="website" type="url" defaultValue={club.website ?? ""} placeholder="https://" />
                  </Label>
                  <Label>
                    Instagram
                    <Input name="instagram" type="url" defaultValue={club.instagram ?? ""} placeholder="https://instagram.com/…" />
                  </Label>
                </div>
                <Label>
                  Contact e-mail (public; also receives new applications)
                  <Input name="contactEmail" type="email" defaultValue={club.contactEmail ?? ""} />
                </Label>
              </ActionForm>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>People who can manage this club. New managers request access via “Claim”.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between gap-2 text-xs/relaxed">
                <span className="min-w-0 truncate">
                  {m.name ?? m.email}
                  <span className="block text-muted-foreground">
                    {m.email} · {m.role}
                  </span>
                </span>
                <form action={removeMember.bind(null, slug)}>
                  <input type="hidden" name="userId" value={m.userId} />
                  <Button type="submit" variant="ghost" size="sm">
                    {m.userId === user.id ? "Leave" : "Remove"}
                  </Button>
                </form>
              </div>
            ))}
            {members.length === 0 && <p className="text-xs/relaxed text-muted-foreground">No managers yet (admin view).</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
