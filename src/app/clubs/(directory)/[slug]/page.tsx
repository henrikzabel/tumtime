import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AtSign, CalendarDays, ExternalLink, Link2, Mail, MapPin, Settings, UserPlus } from "lucide-react";

import { OrgChart } from "@/components/clubs/org-chart";
import { RecruitmentTimeline } from "@/components/clubs/recruitment-timeline";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { formatLongDay, toBerlin } from "@/lib/clubs/info-sessions";
import {
  AUDIENCES,
  formatFee,
  formatHours,
  LANGUAGES,
  readProfile,
  readStructure,
  RECRUITMENT_MODES,
  type Audience,
  type Language,
  type RecruitmentMode,
} from "@/lib/clubs/profile";
import { getClubBySlug } from "@/lib/clubs/queries";
import { buildTimeline } from "@/lib/clubs/timeline";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "join", label: "Join" },
  { value: "team", label: "Team" },
  { value: "faqs", label: "FAQs" },
  { value: "projects", label: "Projects" },
  { value: "resources", label: "Resources" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getClubBySlug(slug);
  if (!data) return { title: "Club not found" };
  return { title: data.club.name, description: data.club.tagline ?? data.club.description ?? data.club.sourceDescription ?? undefined };
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs/relaxed text-muted-foreground">{label}</div>
    </div>
  );
}

function ListSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      {title && <h2 className="text-sm font-semibold">{title}</h2>}
      <div className="mt-2 divide-y">{children}</div>
    </section>
  );
}

export default async function ClubPage({ params, searchParams }: PageProps<"/clubs/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const [data, user] = await Promise.all([getClubBySlug(slug), getCurrentUser()]);
  if (!data) notFound();
  const { club, openForms, members, sessions } = data;
  const canManage = !!user && (user.role === "admin" || members.some((m) => m.userId === user.id));
  const claimed = members.length > 0;
  const profile = readProfile(club.profile);
  const roles = readStructure(club.structure);
  const timeline = buildTimeline(profile, sessions, openForms);
  const now = new Date();
  const upcoming = sessions.filter((s) => s.endsAt > now);
  const openRoles = roles.filter((r) => r.open);

  const counts: Partial<Record<Tab, number>> = {
    team: roles.length,
    faqs: profile.faqs.length,
    projects: profile.projects.length,
    resources: profile.resources.length,
  };
  const tabs = TABS.filter((t) => !(t.value in counts) || counts[t.value]! > 0);
  const tab: Tab = tabs.some((t) => t.value === sp.tab) ? (sp.tab as Tab) : "overview";

  // Keep the list filters when switching tabs.
  const keep = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (k === "tab" || typeof v !== "string" ? [] : [[k, v]])));
  const tabHref = (t: Tab) => {
    const p = new URLSearchParams(keep);
    if (t !== "overview") p.set("tab", t);
    const qs = p.toString();
    return `/clubs/${slug}${qs ? `?${qs}` : ""}`;
  };

  const hours = formatHours(club.hoursMin, club.hoursMax);
  const fee = formatFee(club.feeEuros);
  const autoFacts = [
    hours && { value: hours.replace(" h/week", " h"), label: "Time per week for active members" },
    club.memberCount !== null && { value: String(club.memberCount), label: "Members" },
    fee && { value: fee.replace("/year", ""), label: club.feeEuros ? "Membership fee per year" : "Membership fee" },
    club.foundedYear !== null && { value: String(club.foundedYear), label: "Founded" },
  ].filter((x): x is { value: string; label: string } => !!x);
  const facts = [...autoFacts, ...profile.facts];
  const recruitment = club.recruitment as RecruitmentMode | null;

  return (
    <article className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <Link
        href={`/clubs${keep.toString() ? `?${keep}` : ""}`}
        className="mb-3 inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground hover:text-foreground md:hidden"
      >
        <ArrowLeft className="size-3.5" /> All clubs
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
          {club.imageUrl ? (
            <Image src={club.imageUrl} alt="" fill priority sizes="80px" className="object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-2xl font-semibold text-muted-foreground">{club.name[0]}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">{club.name}</h1>
          {club.tagline && <p className="mt-0.5 text-sm text-muted-foreground">{club.tagline}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {club.focusAreas.map((a) => (
              <Badge key={a} variant="outline">
                {a}
              </Badge>
            ))}
            {(club.languages as Language[]).map((l) => (
              <Badge key={l} variant="secondary">
                {LANGUAGES[l]}
              </Badge>
            ))}
            {club.locations.length > 0 && (
              <span className="flex items-center gap-1 text-xs/relaxed text-muted-foreground">
                <MapPin className="size-3" /> {club.locations.join(", ")}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {openForms.length > 0 && (
            <Link href={tabHref("join")} className={buttonVariants({ size: "lg" })}>
              Apply
            </Link>
          )}
          {canManage && (
            <Link href={`/dashboard/${club.slug}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Settings /> Manage
            </Link>
          )}
        </div>
      </header>

      {tab === "overview" && timeline.length > 0 && (
        <div className="mt-8">
          <RecruitmentTimeline items={timeline} term={profile.timelineTerm} />
        </div>
      )}

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b text-sm [scrollbar-width:none]" aria-label="Sections">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={tabHref(t.value)}
            scroll={false}
            aria-current={tab === t.value ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 transition-colors",
              tab === t.value ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.value === "join" && openForms.length + openRoles.length > 0 && (
              <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" aria-label="open" />
            )}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          {facts.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 border-b pb-6 sm:grid-cols-3 lg:grid-cols-4">
              {facts.map((f, i) => (
                <Stat key={i} value={f.value} label={f.label} />
              ))}
            </div>
          )}
          <div className="mt-6 space-y-3 text-sm leading-relaxed whitespace-pre-line">
            {club.description ?? club.sourceDescription ?? "No description yet."}
          </div>
          {!club.description && club.sourceDescription && (
            <p className="mt-2 text-[0.6875rem] text-muted-foreground">Description: TUM Student Club Gallery</p>
          )}
          {profile.activities.length > 0 && (
            <ListSection title="What they do">
              {profile.activities.map((a, i) => (
                <div key={i} className="py-3">
                  <h3 className="text-sm font-medium">{a.title}</h3>
                  {a.description && <p className="mt-0.5 text-sm text-muted-foreground">{a.description}</p>}
                </div>
              ))}
            </ListSection>
          )}
          <div className="mt-8 flex flex-wrap gap-2">
            {club.website && (
              <a href={club.website} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                <ExternalLink /> Website
              </a>
            )}
            {club.instagram && (
              <a href={club.instagram} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                <AtSign /> Instagram
              </a>
            )}
            {club.linkedin && (
              <a href={club.linkedin} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                <Link2 /> LinkedIn
              </a>
            )}
            {club.contactEmail && (
              <a href={`mailto:${club.contactEmail}`} className={buttonVariants({ variant: "outline" })}>
                <Mail /> Contact
              </a>
            )}
          </div>
        </>
      )}

      {tab === "join" && (
        <div className="mt-6 space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs/relaxed text-muted-foreground">How to join</div>
              <div className="text-sm font-medium">{recruitment ? RECRUITMENT_MODES[recruitment] : "Ask the club"}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs/relaxed text-muted-foreground">Time commitment</div>
              <div className="text-sm font-medium">{hours ?? "Not specified"}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs/relaxed text-muted-foreground">Open to</div>
              <div className="text-sm font-medium">
                {club.audience.length ? (club.audience as Audience[]).map((a) => AUDIENCES[a]).join(", ") : "All students"}
              </div>
            </div>
          </div>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Applications</h2>
            {openForms.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {openForms.map((f) => (
                  <div key={f.id} className="flex flex-col gap-2 rounded-lg border p-4">
                    <h3 className="font-medium">{f.title}</h3>
                    {f.closesAt && (
                      <p className="text-xs/relaxed font-medium text-[#8a5d00] dark:text-[#f5c451]">
                        Apply until {formatDate(toBerlin(f.closesAt).date)}
                      </p>
                    )}
                    {f.intro && <p className="line-clamp-4 text-xs/relaxed whitespace-pre-line text-muted-foreground">{f.intro}</p>}
                    <Link href={`/clubs/${club.slug}/apply/${f.id}`} className={cn(buttonVariants({ size: "lg" }), "mt-auto w-fit")}>
                      Apply now
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {club.name} isn&apos;t accepting applications on TUM Time right now.
                {club.website ? " Check their website for other ways to get involved." : ""}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight">Info sessions</h2>
            {upcoming.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex gap-3 rounded-lg border p-3">
                    <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0 text-sm">
                      <div className="font-medium">
                        {formatLongDay(toBerlin(s.startsAt).date)}, {toBerlin(s.startsAt).time}–{toBerlin(s.endsAt).time}
                      </div>
                      <div className="text-xs/relaxed text-muted-foreground">
                        {[s.venue, s.campus, s.language ? LANGUAGES[s.language as Language] : null, s.periodTitle].filter(Boolean).join(" · ")}
                        {s.onlineUrl && (
                          <>
                            {" · "}
                            <a href={s.onlineUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                              Join online
                            </a>
                          </>
                        )}
                      </div>
                      {s.notes && <p className="mt-1 text-xs/relaxed">{s.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No upcoming info sessions.{" "}
                <Link href="/clubs/info-sessions" className="text-primary underline-offset-4 hover:underline">
                  See all clubs&apos; sessions
                </Link>
              </p>
            )}
          </section>

          {openRoles.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold tracking-tight">Open positions</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {openRoles.map((r) => (
                  <li key={r.id} className="flex gap-3 rounded-lg border border-dashed border-primary/60 p-3">
                    <UserPlus className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="text-sm">
                      <div className="font-medium">{r.title}</div>
                      {r.description && <p className="text-xs/relaxed text-muted-foreground">{r.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === "team" && (
        <section className="mt-8">
          <OrgChart roles={roles} />
          <p className="mt-4 text-center text-[0.6875rem] text-muted-foreground">Maintained by the club. Dashed roles are looking for people.</p>
        </section>
      )}

      {tab === "faqs" && (
        <div className="mt-4 divide-y">
          {profile.faqs.map((f, i) => (
            <details key={i} className="group py-3" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                {f.question}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{f.answer}</p>
            </details>
          ))}
        </div>
      )}

      {tab === "projects" && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {profile.projects.map((p, i) => (
            <div key={i} className="rounded-lg border p-4">
              <h3 className="font-medium">{p.title}</h3>
              {p.description && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{p.description}</p>}
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs/relaxed text-primary hover:underline">
                  <ExternalLink className="size-3" /> Learn more
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "resources" && (
        <ul className="mt-4 divide-y">
          {profile.resources.map((r, i) => (
            <li key={i}>
              <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary">
                {r.label}
                <ExternalLink className="size-3.5 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {!canManage && (
        <p className="mt-12 border-t pt-4 text-xs/relaxed text-muted-foreground">
          {claimed ? "This profile is managed by the club. " : "Are you part of this club? "}
          <Link href={`/clubs/${club.slug}/claim`} className="text-primary underline-offset-4 hover:underline">
            {claimed ? "Request access to manage it" : "Claim this profile"}
          </Link>{" "}
          to add details, your team structure and application forms.
        </p>
      )}
    </article>
  );
}
