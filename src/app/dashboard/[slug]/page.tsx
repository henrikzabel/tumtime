import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Circle, CircleCheck, Inbox, Plus } from "lucide-react";

import { DashboardNav } from "@/components/clubs/dashboard/dashboard-nav";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { removeMember } from "@/lib/clubs/actions";
import { getClubSessions } from "@/lib/clubs/info-session-queries";
import { readProfile, readStructure } from "@/lib/clubs/profile";
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
  const profile = readProfile(club.profile);
  const sessions = await getClubSessions(club.id);
  const checklist = [
    { label: "Write a tagline and description", href: "/profile", done: !!club.tagline && !!club.description },
    { label: "Time commitment per week", href: "/profile", done: club.hoursMin !== null || club.hoursMax !== null },
    { label: "Languages and who can join", href: "/profile", done: club.languages.length > 0 && club.audience.length > 0 },
    { label: "Key facts (fees, meetings, requirements)", href: "/profile#facts", done: profile.facts.length > 0 || club.feeEuros !== null },
    { label: "FAQs", href: "/profile#faqs", done: profile.faqs.length > 0 },
    { label: "Team structure", href: "/structure", done: readStructure(club.structure).length > 0 },
    { label: "Recruitment timeline or info session", href: "/recruitment", done: profile.timeline.length > 0 || sessions.length > 0 },
    { label: "An open sign-up form", href: "", done: forms.some((f) => f.status === "open") },
  ];
  const done = checklist.filter((c) => c.done).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      <DashboardNav slug={slug} name={club.name} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/dashboard/${slug}/applications`} className={buttonVariants({ size: "lg" })}>
          <Inbox /> Applications ({total}
          {fresh ? `, ${fresh} new` : ""})
        </Link>
        <span className="text-xs/relaxed text-muted-foreground">
          Profile {done}/{checklist.length} complete
        </span>
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
              <CardTitle>Make your profile stand out</CardTitle>
              <CardDescription>Students filter by time commitment, language and audience — clubs without these details are hidden by those filters.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {checklist.map((c) => (
                  <li key={c.label}>
                    <Link href={`/dashboard/${slug}${c.href}`} className="flex items-center gap-2 text-sm hover:text-primary">
                      {c.done ? <CircleCheck className="size-4 text-primary" /> : <Circle className="size-4 text-muted-foreground" />}
                      <span className={c.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}>{c.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>People who can manage this club on TUM Time. New managers request access via “Claim”. (The public hierarchy is edited under “Team structure”.)</CardDescription>
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
