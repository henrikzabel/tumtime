import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EntryActions } from "@/components/catalog/entry-actions";
import { ModuleGrades } from "@/components/module-grades";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { getCatalogDetail, type CatalogDetail } from "@/lib/catalog/queries";
import { COURSE_KEY_PREFIX } from "@/lib/catalog/entries";
import type { TimetableCourse } from "@/lib/planner/queries";
import { formatSlot, weeklySlots } from "@/lib/planner/timetable";
import { getBookmarkCodes, listSchedules } from "@/lib/planning/queries";
import { getModuleDetail } from "@/lib/queries";
import { formatSemesterShort, parseSemester } from "@/lib/stats/semester";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "sections", label: "Sections" },
  { value: "grades", label: "Grades" },
] as const;
type Tab = (typeof TABS)[number]["value"];

async function load(params: PageProps<"/catalog/[semester]/[key]">["params"]) {
  const { semester: rawSemester, key } = await params;
  const semester = parseSemester(rawSemester);
  if (!semester) return null;
  return getCatalogDetail(semester, decodeURIComponent(key));
}

export async function generateMetadata({ params }: PageProps<"/catalog/[semester]/[key]">): Promise<Metadata> {
  const detail = await load(params);
  if (!detail) return { title: "Not found" };
  const label = detail.kind === "module" ? `${detail.key} ${detail.title}` : detail.title;
  return { title: label, description: `${label} at TUM: description, dates, rooms and grade statistics.` };
}

export default async function CatalogEntryPage({ params, searchParams }: PageProps<"/catalog/[semester]/[key]">) {
  const detail = await load(params);
  if (!detail) notFound();
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.value === sp.tab) ? (sp.tab as Tab) : "overview";
  const [user, grades] = await Promise.all([getCurrentUser(), detail.kind === "module" ? getModuleDetail(detail.key) : null]);
  const [bookmarks, schedules] = user
    ? await Promise.all([getBookmarkCodes(user.id), listSchedules(user.id, detail.semester)])
    : [[], []];

  // Keep the list filters (q, school …) when switching tabs.
  const keep = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (k === "tab" || k === "type" || typeof v !== "string" ? [] : [[k, v]])),
  );
  const tabHref = (t: Tab, extra?: Record<string, string>) => {
    const p = new URLSearchParams(keep);
    if (t !== "overview") p.set("tab", t);
    for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
    const qs = p.toString();
    return `/catalog/${detail.semester}/${detail.key}${qs ? `?${qs}` : ""}`;
  };
  const listHref = `/catalog/${detail.semester}${keep.toString() ? `?${keep}` : ""}`;
  const languages = [...new Set(detail.courses.flatMap((c) => c.languages.map((l) => l.toUpperCase())))];

  return (
    <article className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <Link href={listHref} className="mb-3 inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground hover:text-foreground md:hidden">
        <ArrowLeft className="size-3.5" /> All results
      </Link>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-mono">
              {detail.key.startsWith(COURSE_KEY_PREFIX) ? "Course" : detail.key}
            </Badge>
            {detail.ects !== null && <Badge variant="outline">{detail.ects} ECTS</Badge>}
            {languages.map((l) => (
              <Badge key={l} variant="outline">
                {l === "DE" ? "German" : l === "EN" ? "English" : l}
              </Badge>
            ))}
            {detail.otherSemesters.slice(0, 4).map((s) => (
              <Link key={s} href={`/catalog/${s}/${detail.key}`}>
                <Badge variant="ghost" className="text-muted-foreground hover:text-foreground">
                  also {formatSemesterShort(s)}
                </Badge>
              </Link>
            ))}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance md:text-3xl">{detail.title}</h1>
          {detail.titleDe && <p className="mt-0.5 text-sm text-muted-foreground">{detail.titleDe}</p>}
          <p className="mt-1 text-xs/relaxed text-muted-foreground">
            {[detail.school, detail.department].filter(Boolean).join(" · ")}
          </p>
        </div>
        <EntryActions
          entryKey={detail.key}
          semester={detail.semester}
          loggedIn={!!user}
          bookmarked={bookmarks.includes(detail.key)}
          schedules={schedules.map((s) => ({ id: s.id, name: s.name, has: s.moduleCodes.includes(detail.key) }))}
        />
      </header>

      <nav className="mt-6 flex gap-1 border-b text-sm" aria-label="Sections">
        {TABS.filter((t) => t.value !== "grades" || detail.kind === "module").map((t) => (
          <Link
            key={t.value}
            href={tabHref(t.value)}
            scroll={false}
            aria-current={tab === t.value ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 transition-colors",
              tab === t.value ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.value === "grades" && grades && <span className="ml-1 text-xs text-muted-foreground">({grades.exams.length})</span>}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "overview" && <Overview detail={detail} />}
        {tab === "sections" && <Sections schedule={detail.schedule} />}
        {tab === "grades" &&
          (grades ? (
            <ModuleGrades exams={grades.exams} type={sp.type} filterHref={(t) => tabHref("grades", t ? { type: t } : undefined)} />
          ) : (
            <p className="rounded-lg bg-muted/60 p-6 text-center text-sm text-muted-foreground">
              No exam statistics for {detail.key} yet.{" "}
              <Link href="/contribute" className="underline underline-offset-4">
                Contribute them
              </Link>
              .
            </p>
          ))}
      </div>
    </article>
  );
}

function Block({ title, text }: { title: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-sm/relaxed whitespace-pre-line text-muted-foreground">{text}</p>
    </section>
  );
}

const CYCLE: Record<string, string> = { winter: "Winter semester", summer: "Summer semester", both: "Every semester" };

function Overview({ detail }: { detail: CatalogDetail }) {
  const d = detail.description;
  const courseText = detail.courses.find((c) => c.description && !/^see module description/i.test(c.description));
  const facts = [
    ["Offered", d?.cycle ? CYCLE[d.cycle] : null],
    ["Level", d?.level],
    ["Organisation", d?.organisation ?? detail.courses[0]?.orgName],
    ["Courses this semester", detail.courses.length ? String(detail.courses.length) : null],
  ].filter((f): f is [string, string] => !!f[1]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
      <div className="space-y-5">
        <Block title="Content" text={d?.content ?? courseText?.description} />
        <Block title="Learning outcomes" text={d?.outcome} />
        <Block title="Prerequisites" text={d?.precondition} />
        <Block title="Assessment" text={d?.exam} />
        <Block title="Teaching method" text={detail.courses.find((c) => c.teachingMethod)?.teachingMethod} />
        {!d && !courseText && <p className="text-sm text-muted-foreground">No description available.</p>}
      </div>
      <aside className="space-y-4">
        {facts.length > 0 && (
          <dl className="space-y-2 rounded-lg border p-3 text-sm">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {detail.courses.length > 0 && (
          <div className="rounded-lg border p-3 text-sm">
            <h2 className="text-xs text-muted-foreground">In TUMonline</h2>
            <ul className="mt-1 space-y-1">
              {detail.courses.map((c) => (
                <li key={c.id}>
                  <a
                    href={c.tumonlineUrl ?? `https://campus.tum.de/tumonline/ee/ui/ca2/app/desktop/#/slc.tm.cp/student/courses/${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-1 hover:underline"
                  >
                    <ExternalLink className="mt-1 size-3 shrink-0" />
                    <span>
                      {c.activity && <span className="font-mono text-xs text-muted-foreground">{c.activity} </span>}
                      {c.title}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Berlin" });

function Sections({ schedule }: { schedule: TimetableCourse[] }) {
  if (schedule.length === 0) {
    return <p className="rounded-lg bg-muted/60 p-6 text-center text-sm text-muted-foreground">No regular dates published yet.</p>;
  }
  const rank = (a: string | null) => (a ? ["VO", "VI", "UE", "TT"].indexOf(a) + 1 || 9 : 9);
  const firstSlot = (g: TimetableCourse["groups"][number]) => {
    const s = weeklySlots(g.events)[0];
    return s ? s.weekday * 1440 + s.startMinutes : Infinity;
  };
  const sorted = [...schedule]
    .sort((a, b) => rank(a.activity) - rank(b.activity) || a.title.localeCompare(b.title))
    .map((c) => ({ ...c, groups: [...c.groups].sort((a, b) => firstSlot(a) - firstSlot(b) || a.name.localeCompare(b.name)) }));
  return (
    <div className="space-y-6">
      {sorted.map((c) => (
        <section key={c.id}>
          <h2 className="flex flex-wrap items-baseline gap-2 text-sm font-semibold">
            <span>{c.activityName ? c.activityName[0].toUpperCase() + c.activityName.slice(1) : "Course"}</span>
            <span className="font-normal text-muted-foreground">{c.title}</span>
          </h2>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Group</th>
                  <th className="px-3 py-1.5 font-medium">Weekly</th>
                  <th className="px-3 py-1.5 font-medium">Room</th>
                  <th className="px-3 py-1.5 font-medium">Period</th>
                  <th className="px-3 py-1.5 text-right font-medium">Seats</th>
                </tr>
              </thead>
              <tbody>
                {c.groups.map((g) => {
                  const slots = weeklySlots(g.events);
                  const active = g.events.filter((e) => !e.canceled);
                  const rooms = [...new Map(active.filter((e) => e.room).map((e) => [e.room, e.roomUrl])).entries()];
                  return (
                    <tr key={g.id} className="border-t align-top">
                      <td className="px-3 py-2">{g.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {slots.map((s) => (
                          <div key={`${s.weekday}-${s.startMinutes}`}>{formatSlot(s)}</div>
                        ))}
                      </td>
                      <td className="px-3 py-2">
                        {rooms.slice(0, 3).map(([room, url]) =>
                          url ? (
                            <a key={room} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                              <MapPin className="size-3 shrink-0" />
                              {room}
                            </a>
                          ) : (
                            <div key={room}>{room}</div>
                          ),
                        )}
                        {rooms.length > 3 && <div className="text-xs text-muted-foreground">+{rooms.length - 3} more</div>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {active.length > 0 &&
                          `${dateFmt.format(new Date(active[0].start))} – ${dateFmt.format(new Date(active.at(-1)!.start))} · ${active.length}×`}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.maxStudents ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
