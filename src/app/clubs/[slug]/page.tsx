import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AtSign, ExternalLink, Mail, MapPin, Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getClubBySlug } from "@/lib/clubs/queries";
import { formatDate } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getClubBySlug(slug);
  if (!data) return { title: "Club not found" };
  return { title: data.club.name, description: data.club.description ?? data.club.sourceDescription ?? undefined };
}

export default async function ClubPage({ params }: PageProps<"/clubs/[slug]">) {
  const { slug } = await params;
  const [data, user] = await Promise.all([getClubBySlug(slug), getCurrentUser()]);
  if (!data) notFound();
  const { club, openForms, members } = data;
  const canManage = !!user && (user.role === "admin" || members.some((m) => m.userId === user.id));
  const claimed = members.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
      <Link href="/clubs" className="text-xs/relaxed text-muted-foreground hover:text-foreground">
        ← All clubs
      </Link>
      <div className="mt-3 overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
        {club.imageUrl && (
          <div className="relative aspect-[3/1] bg-muted">
            <Image src={club.imageUrl} alt="" fill priority sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{club.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {club.focusAreas.map((a) => (
                  <Badge key={a} variant="outline">
                    {a}
                  </Badge>
                ))}
                {club.locations.length > 0 && (
                  <span className="flex items-center gap-1 text-xs/relaxed text-muted-foreground">
                    <MapPin className="size-3" /> {club.locations.join(", ")}
                  </span>
                )}
              </div>
            </div>
            {canManage && (
              <Link href={`/dashboard/${club.slug}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                <Settings /> Manage club
              </Link>
            )}
          </div>

          <div className="mt-5 space-y-3 text-sm leading-relaxed whitespace-pre-line">
            {club.description ?? club.sourceDescription ?? "No description yet."}
          </div>
          {!club.description && club.sourceDescription && (
            <p className="mt-2 text-[0.6875rem] text-muted-foreground">Description: TUM Student Club Gallery</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {club.website && (
              <a href={club.website} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                <ExternalLink /> Website
              </a>
            )}
            {club.instagram && (
              <a href={club.instagram} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                <AtSign /> Instagram
              </a>
            )}
            {club.contactEmail && (
              <a href={`mailto:${club.contactEmail}`} className={buttonVariants({ variant: "outline" })}>
                <Mail /> Contact
              </a>
            )}
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Join {club.name}</h2>
        {openForms.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {openForms.map((f) => (
              <Card key={f.id}>
                <CardHeader>
                  <CardTitle>{f.title}</CardTitle>
                  {f.closesAt && <CardDescription>Apply until {formatDate(f.closesAt.toISOString().slice(0, 10))}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {f.intro && <p className="line-clamp-4 text-xs/relaxed text-muted-foreground whitespace-pre-line">{f.intro}</p>}
                  <Link href={`/clubs/${club.slug}/apply/${f.id}`} className={buttonVariants({ size: "lg" })}>
                    Apply now
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {club.name} isn&apos;t accepting applications on TUM Time right now.
            {club.website ? " Check their website for other ways to get involved." : ""}
          </p>
        )}
      </section>

      {!canManage && (
        <p className="mt-10 text-xs/relaxed text-muted-foreground">
          {claimed ? "This profile is managed by the club. " : "Are you part of this club? "}
          <Link href={`/clubs/${club.slug}/claim`} className="text-primary underline-offset-4 hover:underline">
            {claimed ? "Request access to manage it" : "Claim this profile"}
          </Link>{" "}
          to edit the description and accept applications.
        </p>
      )}
    </div>
  );
}
