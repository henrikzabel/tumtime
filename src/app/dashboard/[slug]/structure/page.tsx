import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardNav } from "@/components/clubs/dashboard/dashboard-nav";
import { StructureEditor } from "@/components/clubs/dashboard/structure-editor";
import { requireUser } from "@/lib/auth/session";
import { readStructure } from "@/lib/clubs/profile";
import { getManagedClub } from "@/lib/clubs/queries";

export const metadata: Metadata = { title: "Team structure", robots: { index: false } };

export default async function ClubStructurePage({ params }: PageProps<"/dashboard/[slug]/structure">) {
  const { slug } = await params;
  const user = await requireUser(`/dashboard/${slug}/structure`);
  const club = await getManagedClub(slug, user);
  if (!club) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
      <DashboardNav slug={slug} name={club.name} />
      <StructureEditor slug={slug} initial={readStructure(club.structure)} />
    </div>
  );
}
