import type { Metadata } from "next";
import Link from "next/link";
import { Download, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logout } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { deleteAccount, withdrawApplication } from "@/lib/clubs/actions";
import { getMyOverview } from "@/lib/clubs/queries";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/clubs/status";

import { ConfirmButton } from "./confirm-button";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const user = await requireUser("/me");
  const { applied } = await searchParams;
  const { apps, memberships, claims } = await getMyOverview(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.role === "admin" && (
            <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
              Admin
            </Link>
          )}
          <form action={logout}>
            <Button type="submit" variant="outline">
              <LogOut /> Sign out
            </Button>
          </form>
        </div>
      </div>

      {applied && (
        <p className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          Application sent! You&apos;ll get an e-mail when the club updates its status.
        </p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Your applications</CardTitle>
          <CardDescription>Applications are deleted automatically 6 months after you sent them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {apps.length === 0 && (
            <p className="text-sm text-muted-foreground">
              None yet. <Link href="/clubs" className="text-primary hover:underline">Discover clubs →</Link>
            </p>
          )}
          {apps.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-2 ring-1 ring-foreground/10">
              <div className="min-w-0">
                <Link href={`/clubs/${a.clubSlug}`} className="block truncate text-sm font-medium hover:underline">
                  {a.clubName}
                </Link>
                <span className="text-[0.6875rem] text-muted-foreground">
                  {a.formTitle} · sent {a.createdAt.toLocaleDateString("en-GB")}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={a.status === "accepted" ? "default" : "outline"}>
                  {STATUS_LABELS[a.status as ApplicationStatus] ?? a.status}
                </Badge>
                <form action={withdrawApplication}>
                  <input type="hidden" name="applicationId" value={a.id} />
                  <ConfirmButton message="Withdraw and delete this application?" variant="ghost" size="sm">
                    Withdraw
                  </ConfirmButton>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {(memberships.length > 0 || claims.length > 0) && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Clubs you manage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {memberships.map((m) => (
              <Link
                key={m.slug}
                href={`/dashboard/${m.slug}`}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm ring-1 ring-foreground/10 hover:bg-muted/50"
              >
                {m.name} <span className="text-xs/relaxed text-muted-foreground">Open dashboard →</span>
              </Link>
            ))}
            {claims.map((c) => (
              <p key={c.clubSlug} className="text-xs/relaxed text-muted-foreground">
                Request to manage <strong>{c.clubName}</strong> is waiting for review.
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            We store your e-mail address, your name (once you apply), your applications and the clubs you manage.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <a href="/api/me/export" className={buttonVariants({ variant: "outline" })}>
            <Download /> Download my data (JSON)
          </a>
          <form action={deleteAccount}>
            <ConfirmButton message="Delete your account and all your applications permanently?" variant="destructive">
              Delete account
            </ConfirmButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
