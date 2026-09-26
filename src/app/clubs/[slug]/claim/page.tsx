import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { submitClaim } from "@/lib/clubs/actions";
import { getClubBySlug } from "@/lib/clubs/queries";

export const metadata: Metadata = { title: "Claim club profile" };

export default async function ClaimPage({ params }: PageProps<"/clubs/[slug]/claim">) {
  const { slug } = await params;
  const user = await requireUser(`/clubs/${slug}/claim`);
  const data = await getClubBySlug(slug);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Link href={`/clubs/${slug}`} className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← {data.club.name}
      </Link>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="text-base">Manage {data.club.name} on TUM Time</CardTitle>
          <CardDescription>
            Tell us how you are involved. We verify requests manually, usually within a few days, and notify{" "}
            {user.email} by e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={submitClaim.bind(null, slug)} submitLabel="Send request" pendingLabel="Sending…">
            <Label>
              Your role in the club
              <Input name="position" required maxLength={120} placeholder="e.g. Board member, Head of HR" />
            </Label>
            <Label>
              Anything that helps us verify you (optional)
              <Textarea name="message" maxLength={1000} placeholder="e.g. a link to the team page listing you" />
            </Label>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
