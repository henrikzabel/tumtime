import type { Metadata } from "next";

import { ClubDirectory } from "@/components/clubs/club-directory";
import { listClubs } from "@/lib/clubs/queries";

export const metadata: Metadata = {
  title: "Student clubs",
  description: "Discover the student clubs at TUM and apply directly.",
};
export const revalidate = 300;

export default async function ClubsPage() {
  const clubs = await listClubs();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Student clubs</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        {clubs.length} student initiatives at TUM — find your community, see who is recruiting and apply in a few
        clicks.
      </p>
      <ClubDirectory clubs={clubs} />
      <p className="mt-10 text-xs/relaxed text-muted-foreground">
        Club list and short descriptions:{" "}
        <a
          href="https://www.tum.de/en/community/campus-life/student-clubs-gallery"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          TUM Student Club Gallery
        </a>
        . Clubs can claim their profile to write their own description and accept applications.
      </p>
    </div>
  );
}
