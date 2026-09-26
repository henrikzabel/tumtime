import { CalendarRange, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CatalogShell } from "@/components/catalog/catalog-shell";
import { ClubBrowser } from "@/components/clubs/club-browser";
import { listPeriods } from "@/lib/clubs/info-session-queries";
import { formatRange } from "@/lib/clubs/info-sessions";
import { listClubs } from "@/lib/clubs/queries";

export const metadata: Metadata = {
  title: "Student clubs",
  description: "Discover the student clubs at TUM: time commitment, structure, recruitment timelines, info sessions and applications.",
};

export default async function ClubsLayout({ children }: LayoutProps<"/clubs">) {
  const [clubs, periods] = await Promise.all([listClubs(), listPeriods({ status: ["published"] })]);
  const today = new Date().toISOString().slice(0, 10);
  const current = periods.filter((p) => p.endsOn >= today).at(-1) ?? null;

  return (
    <CatalogShell
      list={
        <Suspense>
          <ClubBrowser
            clubs={clubs}
            banner={
              current && (
                <Link href="/clubs/info-sessions" className="flex items-center gap-3 bg-primary/6 px-3 py-2.5 transition-colors hover:bg-primary/10">
                  <CalendarRange className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{current.title}</span>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      {formatRange(current.startsOn, current.endsOn)} · every evening, all clubs in one place
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              )
            }
          />
        </Suspense>
      }
    >
      {children}
    </CatalogShell>
  );
}
