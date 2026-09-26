import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Trash2 } from "lucide-react";

import { DashboardNav } from "@/components/clubs/dashboard/dashboard-nav";
import { ListEditor } from "@/components/clubs/dashboard/list-editor";
import { ActionForm } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { saveProfileSection } from "@/lib/clubs/actions";
import {
  addInfoSession,
  deleteInfoSession,
  saveInfoSessionRequest,
  withdrawInfoSessionRequest,
} from "@/lib/clubs/info-session-actions";
import { getClubRequests, getClubSessions, listPeriods } from "@/lib/clubs/info-session-queries";
import { formatDay, formatLongDay, formatRange, periodDates, toBerlin } from "@/lib/clubs/info-sessions";
import { MILESTONE_KINDS, readProfile } from "@/lib/clubs/profile";
import { getManagedClub } from "@/lib/clubs/queries";

export const metadata: Metadata = { title: "Recruitment & info sessions", robots: { index: false } };

const selectCls =
  "h-8 w-full rounded-md border border-input bg-input/20 px-2 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

export default async function RecruitmentPage({ params }: PageProps<"/dashboard/[slug]/recruitment">) {
  const { slug } = await params;
  const user = await requireUser(`/dashboard/${slug}/recruitment`);
  const club = await getManagedClub(slug, user);
  if (!club) notFound();
  const [profile, periods, requests, sessions] = await Promise.all([
    readProfile(club.profile),
    listPeriods({ status: ["collecting", "published"] }),
    getClubRequests(club.id),
    getClubSessions(club.id),
  ]);
  const today = toBerlin(new Date()).date;
  const activePeriods = periods.filter((p) => p.endsOn >= today);
  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
      <DashboardNav slug={slug} name={club.name} />
      <div className="mt-6 space-y-6">
        {activePeriods.map((p) => {
          const req = requests.find((r) => r.periodId === p.id);
          const mine = sessions.filter((s) => s.periodId === p.id);
          const campuses = [...new Set(p.venues.map((v) => v.campus).filter(Boolean))];
          return (
            <Card key={p.id} className="ring-primary/40">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <CalendarDays className="size-4 text-primary" /> {p.title}
                  <Badge variant={p.status === "published" ? "default" : "outline"}>
                    {p.status === "published" ? "Schedule published" : "Requests open"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {formatRange(p.startsOn, p.endsOn)} · {p.slots.map((s) => `${s.start}–${s.end}`).join(", ")} ·{" "}
                  {p.venues.length} rooms in parallel. {p.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mine.length > 0 && (
                  <div className="rounded-md bg-primary/8 p-3 text-sm">
                    {p.status === "published" ? "Your slot: " : "Tentative slot (not published yet): "}
                    {mine.map((s) => (
                      <strong key={s.id}>
                        {formatLongDay(toBerlin(s.startsAt).date)}, {toBerlin(s.startsAt).time}–{toBerlin(s.endsAt).time} · {s.venue}
                      </strong>
                    ))}
                  </div>
                )}
                {p.status === "collecting" ? (
                  <>
                    <ActionForm action={saveInfoSessionRequest.bind(null, slug, p.id)} submitLabel={req ? "Update request" : "Request a slot"}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs/relaxed">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="py-1 font-medium">Night</th>
                              <th className="py-1 text-center font-medium">Preferred</th>
                              <th className="py-1 text-center font-medium">Can&apos;t make it</th>
                            </tr>
                          </thead>
                          <tbody>
                            {periodDates(p).map((d) => (
                              <tr key={d} className="border-t">
                                <td className="py-1">{formatDay(d)}</td>
                                <td className="py-1 text-center">
                                  <input
                                    type="checkbox"
                                    name="preferredDates"
                                    value={d}
                                    defaultChecked={req?.preferredDates.includes(d)}
                                    aria-label={`Prefer ${formatDay(d)}`}
                                    className="accent-[var(--primary)]"
                                  />
                                </td>
                                <td className="py-1 text-center">
                                  <input
                                    type="checkbox"
                                    name="avoidDates"
                                    value={d}
                                    defaultChecked={req?.avoidDates.includes(d)}
                                    aria-label={`Can't make it on ${formatDay(d)}`}
                                    className="accent-[var(--destructive)]"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <fieldset className="flex flex-wrap items-center gap-3">
                        <legend className="mb-1 text-xs/relaxed font-medium">Preferred times (none = any)</legend>
                        {p.slots.map((s) => (
                          <label key={s.start} className="flex items-center gap-1.5 text-xs/relaxed">
                            <input
                              type="checkbox"
                              name="preferredTimes"
                              value={s.start}
                              defaultChecked={req?.preferredTimes.includes(s.start)}
                              className="accent-[var(--primary)]"
                            />
                            {s.start}–{s.end}
                          </label>
                        ))}
                      </fieldset>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {campuses.length > 1 && (
                          <Label>
                            Preferred campus
                            <select name="campus" defaultValue={req?.campus ?? ""} className={selectCls}>
                              <option value="">No preference</option>
                              {campuses.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </Label>
                        )}
                        <Label>
                          Session language
                          <select name="language" defaultValue={req?.language ?? ""} className={selectCls}>
                            <option value="">Not decided</option>
                            <option value="en">English</option>
                            <option value="de">German</option>
                          </select>
                        </Label>
                      </div>
                      <Label>
                        Notes for the organisers (optional)
                        <Textarea name="notes" rows={2} maxLength={500} defaultValue={req?.notes ?? ""} className="min-h-0" />
                      </Label>
                    </ActionForm>
                    {req && (
                      <form action={withdrawInfoSessionRequest.bind(null, slug)}>
                        <input type="hidden" name="periodId" value={p.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Withdraw request
                        </Button>
                      </form>
                    )}
                    <p className="text-[0.6875rem] text-muted-foreground">
                      The organisers schedule all clubs at once so that clubs with the same focus never run in parallel —
                      students can visit every club they&apos;re interested in.
                    </p>
                  </>
                ) : (
                  mine.length === 0 && <p className="text-xs/relaxed text-muted-foreground">Your club isn&apos;t part of this schedule.</p>
                )}
                <Link href="/clubs/info-sessions" className="text-xs/relaxed text-primary underline-offset-4 hover:underline">
                  View the public schedule →
                </Link>
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle>Your own info sessions</CardTitle>
            <CardDescription>Sessions outside the central info session weeks, e.g. an open lab evening. They appear on your timeline and in the schedule.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-1.5">
              {sessions
                .filter((s) => s.periodId === null)
                .map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 ring-1 ring-foreground/10">
                    <span className={s.endsAt < now ? "text-muted-foreground" : ""}>
                      <span className="block text-sm font-medium">
                        {formatLongDay(toBerlin(s.startsAt).date)}, {toBerlin(s.startsAt).time}–{toBerlin(s.endsAt).time}
                      </span>
                      <span className="text-[0.6875rem] text-muted-foreground">
                        {[s.venue, s.campus, s.onlineUrl ? "online" : null, s.language?.toUpperCase()].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <form action={deleteInfoSession.bind(null, slug)}>
                      <input type="hidden" name="sessionId" value={s.id} />
                      <Button type="submit" variant="ghost" size="icon-sm" aria-label="Delete session">
                        <Trash2 />
                      </Button>
                    </form>
                  </li>
                ))}
            </ul>
            <ActionForm action={addInfoSession.bind(null, slug)} submitLabel="Add info session">
              <div className="grid gap-3 sm:grid-cols-3">
                <Label>
                  Date
                  <Input name="date" type="date" required min={today} />
                </Label>
                <Label>
                  From
                  <Input name="start" type="time" required defaultValue="18:00" />
                </Label>
                <Label>
                  To
                  <Input name="end" type="time" required defaultValue="19:00" />
                </Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Label>
                  Room
                  <Input name="venue" maxLength={120} placeholder="e.g. MI HS 1" />
                </Label>
                <Label>
                  Campus
                  <Input name="campus" maxLength={40} placeholder="e.g. Garching" />
                </Label>
                <Label>
                  Language
                  <select name="language" className={selectCls} defaultValue="">
                    <option value="">—</option>
                    <option value="en">English</option>
                    <option value="de">German</option>
                  </select>
                </Label>
              </div>
              <Label>
                Online link (optional)
                <Input name="onlineUrl" type="url" placeholder="https://" />
              </Label>
              <Label>
                Note (optional)
                <Input name="notes" maxLength={300} placeholder="e.g. Pizza afterwards!" />
              </Label>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recruitment timeline</CardTitle>
            <CardDescription>
              Extra milestones for the timeline on your profile. Info sessions and sign-up form deadlines are added
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ListEditor
              action={saveProfileSection.bind(null, slug, "timeline")}
              initial={profile.timeline}
              max={20}
              addLabel="Add milestone"
              extraField={{ name: "timelineTerm", label: "Term label", initial: profile.timelineTerm, placeholder: "e.g. Winter 2026/27", maxLength: 40 }}
              fields={[
                { key: "date", label: "Date", type: "date", span: 2 },
                { key: "kind", label: "Type", type: "select", options: MILESTONE_KINDS, span: 2 },
                { key: "title", label: "Title", maxLength: 80, placeholder: "e.g. Interviews", span: 2 },
                { key: "detail", label: "Detail (optional)", maxLength: 120, placeholder: "e.g. @SOCS 20 or 11:59 PM" },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
