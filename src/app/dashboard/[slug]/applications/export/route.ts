import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { formatAnswer, type Answers, type FormField } from "@/lib/clubs/forms";
import { getClubApplications, getManagedClub } from "@/lib/clubs/queries";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/clubs/status";
import { toCsv } from "@/lib/csv";

export async function GET(request: NextRequest, ctx: RouteContext<"/dashboard/[slug]/applications/export">) {
  const { slug } = await ctx.params;
  const user = await getCurrentUser();
  const club = user ? await getManagedClub(slug, user) : null;
  if (!club) return new NextResponse("Not found", { status: 404 });

  const formId = request.nextUrl.searchParams.get("form");
  const apps = (await getClubApplications(club.id)).filter((a) => !formId || String(a.formId) === formId);

  // Union of all questions (forms can differ), in order of first appearance.
  const columns = new Map<string, FormField>();
  for (const a of apps) for (const f of a.fields as FormField[]) if (!columns.has(f.id)) columns.set(f.id, f);
  const rows: unknown[][] = [
    ["Submitted", "Form", "Name", "E-mail", "Status", "Internal note", ...[...columns.values()].map((f) => f.label)],
    ...apps.map((a) => [
      a.createdAt.toISOString(),
      a.formTitle,
      a.applicantName,
      a.applicantEmail,
      STATUS_LABELS[a.status as ApplicationStatus] ?? a.status,
      a.clubNote ?? "",
      ...[...columns.values()].map((f) => formatAnswer(f, (a.answers as Answers)[f.id])),
    ]),
  ];
  return new NextResponse("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-applications.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
