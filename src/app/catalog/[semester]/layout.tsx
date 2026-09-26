import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { CatalogShell } from "@/components/catalog/catalog-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getCatalogIndex, getCatalogSemesters } from "@/lib/catalog/queries";
import { getBookmarkCodes } from "@/lib/planning/queries";
import { formatSemester, parseSemester } from "@/lib/stats/semester";

export async function generateMetadata({ params }: LayoutProps<"/catalog/[semester]">): Promise<Metadata> {
  const semester = parseSemester((await params).semester);
  return {
    title: semester ? `Catalog ${formatSemester(semester)}` : "Catalog",
    description: "All TUM modules and courses of the semester with dates, rooms, descriptions and grade statistics.",
  };
}

export default async function CatalogLayout({ params, children }: LayoutProps<"/catalog/[semester]">) {
  const semester = parseSemester((await params).semester);
  if (!semester) notFound();
  const [semesters, entries, user] = await Promise.all([getCatalogSemesters(), getCatalogIndex(semester), getCurrentUser()]);
  if (!semesters.includes(semester)) notFound();
  const bookmarks = user ? await getBookmarkCodes(user.id) : [];

  return (
    <CatalogShell
      list={
        <Suspense>
          <CatalogBrowser semester={semester} semesters={semesters} entries={entries} bookmarks={bookmarks} loggedIn={!!user} />
        </Suspense>
      }
    >
      {children}
    </CatalogShell>
  );
}
