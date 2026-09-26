import { CalendarRange, Clock, Network, Sparkles } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { isRecruiting } from "@/lib/clubs/directory";
import { listClubs } from "@/lib/clubs/queries";

export const revalidate = 300;

export default async function ClubsHome() {
  const clubs = await listClubs();
  const recruiting = clubs.filter(isRecruiting).length;
  const withSessions = clubs.filter((c) => c.nextInfoSession).length;
  const openRoles = clubs.reduce((s, c) => s + c.openRoles, 0);

  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Student clubs at TUM</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {clubs.length} student initiatives. Pick one on the left to see what they do, how much time it takes, who runs it and
          how to join.
        </p>
        <ul className="mt-6 grid gap-3 text-left text-sm sm:grid-cols-2">
          <li className="rounded-lg border p-3">
            <Sparkles className="mb-1 size-4 text-primary" />
            <strong className="tabular-nums">{recruiting}</strong> clubs recruiting now
          </li>
          <li className="rounded-lg border p-3">
            <CalendarRange className="mb-1 size-4 text-primary" />
            <strong className="tabular-nums">{withSessions}</strong> upcoming info sessions
          </li>
          <li className="rounded-lg border p-3">
            <Clock className="mb-1 size-4 text-primary" />
            Filter by hours per week, language and campus
          </li>
          <li className="rounded-lg border p-3">
            <Network className="mb-1 size-4 text-primary" />
            Team structures{openRoles > 0 ? ` · ${openRoles} open positions` : ""}
          </li>
        </ul>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/clubs/info-sessions" className={buttonVariants({ size: "lg" })}>
            <CalendarRange /> Info session schedule
          </Link>
        </div>
        <p className="mt-8 text-[0.6875rem] text-muted-foreground">
          Club list and short descriptions:{" "}
          <a
            href="https://www.tum.de/en/community/campus-life/student-clubs-gallery"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            TUM Student Club Gallery
          </a>
          . Clubs can claim their profile to add details, their team and application forms.
        </p>
      </div>
    </div>
  );
}
