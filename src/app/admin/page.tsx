import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { reviewClaim } from "@/lib/clubs/actions";
import { getPendingClaims } from "@/lib/clubs/queries";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  await requireAdmin("/admin");
  const claims = await getPendingClaims();
  const pending = claims.filter((c) => c.status === "pending");
  const decided = claims.filter((c) => c.status !== "pending").slice(0, 20);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <Link href="/admin/info-sessions" className="text-sm text-primary underline-offset-4 hover:underline">
          Plan info session weeks →
        </Link>
      </div>
      <h2 className="mt-8 text-lg font-semibold">Club claims ({pending.length} pending)</h2>
      <div className="mt-3 space-y-3">
        {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
        {pending.map((c) => (
          <Card key={c.id} size="sm">
            <CardHeader>
              <CardTitle>
                <Link href={`/clubs/${c.clubSlug}`} className="hover:underline">
                  {c.clubName}
                </Link>
                {c.claimed && (
                  <Badge variant="outline" className="ml-2">
                    already has managers
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {c.email} · {c.position} · {c.createdAt.toLocaleDateString("en-GB")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {c.message && <p className="text-xs/relaxed whitespace-pre-line">{c.message}</p>}
              <form action={reviewClaim} className="flex gap-2">
                <input type="hidden" name="claimId" value={c.id} />
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
      {decided.length > 0 && (
        <>
          <h2 className="mt-10 text-sm font-semibold text-muted-foreground">Recently decided</h2>
          <ul className="mt-2 space-y-1 text-xs/relaxed text-muted-foreground">
            {decided.map((c) => (
              <li key={c.id}>
                {c.clubName} — {c.email}: <strong>{c.status}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
