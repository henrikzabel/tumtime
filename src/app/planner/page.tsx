import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPrograms } from "@/lib/planner/queries";

export const metadata: Metadata = { title: "Study planner" };
export const revalidate = 600;

export default async function PlannerIndexPage() {
  const programs = await listPrograms();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Study planner</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        Start from the recommended study plan of your program, move modules around, pick your electives and see how
        hard each exam has been — then build your weekly timetable.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {programs.map((p) => (
          <Link key={p.slug} href={`/planner/${p.slug}`} className="group">
            <Card className="transition-shadow group-hover:ring-foreground/25">
              <CardHeader>
                <CardDescription>{p.degree}</CardDescription>
                <CardTitle className="flex items-center justify-between text-base">
                  {p.nameEn}
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardTitle>
                <CardDescription>
                  {p.nameDe} · {p.plans} study plan versions
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
        {programs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No programs imported yet. Run <code className="font-mono">npm run import:planner</code>.
          </p>
        )}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        More programs will follow. Study plans come from the TUM School of CIT, module details and dates from TUM&apos;s
        public module handbook and course catalogue. Always double-check with your official FPSO.
      </p>
    </div>
  );
}
