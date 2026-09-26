import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { planningSemester } from "@/importers/planner/match";
import { requireUser } from "@/lib/auth/session";
import { termLabel } from "@/lib/planner/plan";
import { listPrograms } from "@/lib/planner/queries";
import { createDegreePlanFromForm } from "@/lib/planning/actions";
import { semesterKey, type Semester } from "@/lib/stats/semester";

export const metadata: Metadata = { title: "New degree plan" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Starting semesters students can choose from: the last five years up to the next term. */
function startOptions(planning: Semester): Semester[] {
  const last = semesterKey(planning) + 1;
  const out: Semester[] = [];
  for (let k = last; k > last - 11; k--)
    out.push(`${Math.floor(k / 2)}${k % 2 === 1 ? "WS" : "SS"}` as Semester);
  return out;
}

export default async function NewDegreePlanPage({
  searchParams,
}: PageProps<"/degree-planner/new">) {
  const sp = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      typeof v === "string" ? [[k, v]] : [],
    ),
  );
  await requireUser(`/degree-planner/new${qs.size ? `?${qs}` : ""}`);
  const programs = await listPrograms();
  const planning = planningSemester();
  const selected = one(sp.program) ?? programs[0]?.slug;
  const sharedPlan = one(sp.plan);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/degree-planner"
        className="text-xs/relaxed text-muted-foreground hover:text-foreground"
      >
        ← My plans
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        New degree plan
      </h1>
      <p className="mt-1 text-muted-foreground">
        {sharedPlan
          ? "Save the shared plan to your account."
          : "Choose your program and when you started."}
      </p>

      <form action={createDegreePlanFromForm}>
        {sharedPlan && <input type="hidden" name="plan" value={sharedPlan} />}
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold">1. Program</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {programs.map((p) => (
              <label
                key={p.slug}
                className="flex cursor-pointer items-start gap-3 rounded-lg bg-card p-3 ring-1 ring-foreground/10 has-checked:ring-2 has-checked:ring-primary"
              >
                <input
                  type="radio"
                  name="program"
                  value={p.slug}
                  defaultChecked={p.slug === selected}
                  className="mt-1 accent-[var(--primary)]"
                  required
                />
                <span>
                  <span className="block text-xs text-muted-foreground">
                    {p.degree}
                  </span>
                  <span className="font-medium">{p.nameEn}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.nameDe}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            More programs will follow.
          </p>
        </fieldset>

        <Card className="mt-6">
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs/relaxed font-medium">
              2. First semester
              <select
                name="start"
                defaultValue={planning}
                className="h-8 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {startOptions(planning).map((o) => (
                  <option key={o} value={o}>
                    {termLabel(o, 1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs/relaxed font-medium">
              3. Name (optional)
              <Input
                name="name"
                maxLength={60}
                placeholder="e.g. Plan with exchange"
              />
            </label>
          </CardContent>
        </Card>
        <Button type="submit" size="lg" className="mt-4 w-full">
          Create plan
        </Button>
      </form>
    </div>
  );
}
