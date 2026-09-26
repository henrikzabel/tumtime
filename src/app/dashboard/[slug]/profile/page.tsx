import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardNav } from "@/components/clubs/dashboard/dashboard-nav";
import { ListEditor } from "@/components/clubs/dashboard/list-editor";
import { ActionForm } from "@/components/forms/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { saveProfileSection, updateClubProfile } from "@/lib/clubs/actions";
import { AUDIENCES, LANGUAGES, readProfile, RECRUITMENT_MODES } from "@/lib/clubs/profile";
import { getManagedClub } from "@/lib/clubs/queries";

export const metadata: Metadata = { title: "Club profile", robots: { index: false } };

const selectCls =
  "h-8 w-full rounded-md border border-input bg-input/20 px-2 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function Check({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs/relaxed font-normal">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="accent-[var(--primary)]" />
      {label}
    </label>
  );
}

export default async function ClubProfilePage({ params }: PageProps<"/dashboard/[slug]/profile">) {
  const { slug } = await params;
  const user = await requireUser(`/dashboard/${slug}/profile`);
  const club = await getManagedClub(slug, user);
  if (!club) notFound();
  const profile = readProfile(club.profile);
  const section = (s: Parameters<typeof saveProfileSection>[1]) => saveProfileSection.bind(null, slug, s);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
      <DashboardNav slug={slug} name={club.name} />
      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
            <CardDescription>Shown in the directory and used by the filters. Leave fields empty if they don&apos;t apply.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={updateClubProfile.bind(null, slug)} submitLabel="Save basics">
              <Label>
                Tagline (one sentence in the club list)
                <Input name="tagline" maxLength={140} defaultValue={club.tagline ?? ""} placeholder="e.g. We build and race electric cars." />
              </Label>
              <Label>
                Description
                <Textarea name="description" rows={8} maxLength={5000} defaultValue={club.description ?? club.sourceDescription ?? ""} />
              </Label>
              <div className="grid gap-3 sm:grid-cols-4">
                <Label>
                  Hours/week (min)
                  <Input name="hoursMin" type="number" min={0} max={80} defaultValue={club.hoursMin ?? ""} />
                </Label>
                <Label>
                  Hours/week (max)
                  <Input name="hoursMax" type="number" min={0} max={80} defaultValue={club.hoursMax ?? ""} />
                </Label>
                <Label>
                  Members (approx.)
                  <Input name="memberCount" type="number" min={1} defaultValue={club.memberCount ?? ""} />
                </Label>
                <Label>
                  Founded (year)
                  <Input name="foundedYear" type="number" min={1868} defaultValue={club.foundedYear ?? ""} />
                </Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label>
                  Membership fee per year in € (0 = free)
                  <Input name="feeEuros" type="number" min={0} defaultValue={club.feeEuros ?? ""} />
                </Label>
                <Label>
                  How to join
                  <select name="recruitment" defaultValue={club.recruitment ?? ""} className={selectCls}>
                    <option value="">Not specified</option>
                    {Object.entries(RECRUITMENT_MODES).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                <fieldset className="space-y-1">
                  <legend className="text-xs/relaxed font-medium">Languages</legend>
                  {Object.entries(LANGUAGES).map(([v, l]) => (
                    <Check key={v} name="languages" value={v} label={l} checked={club.languages.includes(v)} />
                  ))}
                </fieldset>
                <fieldset className="grid grid-cols-2 gap-1">
                  <legend className="mb-1 text-xs/relaxed font-medium">Open to</legend>
                  {Object.entries(AUDIENCES).map(([v, l]) => (
                    <Check key={v} name="audience" value={v} label={l} checked={club.audience.includes(v)} />
                  ))}
                </fieldset>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Label>
                  Website
                  <Input name="website" type="url" defaultValue={club.website ?? ""} placeholder="https://" />
                </Label>
                <Label>
                  Instagram
                  <Input name="instagram" type="url" defaultValue={club.instagram ?? ""} placeholder="https://instagram.com/…" />
                </Label>
                <Label>
                  LinkedIn
                  <Input name="linkedin" type="url" defaultValue={club.linkedin ?? ""} placeholder="https://linkedin.com/…" />
                </Label>
              </div>
              <Label>
                Contact e-mail (public; also receives new applications)
                <Input name="contactEmail" type="email" defaultValue={club.contactEmail ?? ""} />
              </Label>
            </ActionForm>
          </CardContent>
        </Card>

        <Card id="facts">
          <CardHeader>
            <CardTitle>Key facts</CardTitle>
            <CardDescription>
              Big numbers on your overview, e.g. “5 — general meetings per semester” or “4/5 — meetings required for active
              membership”. Time, members, fee and founding year are added automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ListEditor
              action={section("facts")}
              initial={profile.facts}
              max={12}
              addLabel="Add fact"
              fields={[
                { key: "value", label: "Value", placeholder: "e.g. $10 or 3", maxLength: 24, span: 2 },
                { key: "label", label: "Label", placeholder: "e.g. External events required per semester", maxLength: 120, span: 4 },
              ]}
            />
          </CardContent>
        </Card>

        <Card id="activities">
          <CardHeader>
            <CardTitle>What you do</CardTitle>
            <CardDescription>Recurring formats, flagship projects, trips, socials — whatever a new member gets to do.</CardDescription>
          </CardHeader>
          <CardContent>
            <ListEditor
              action={section("activities")}
              initial={profile.activities}
              max={20}
              addLabel="Add activity"
              fields={[
                { key: "title", label: "Title", maxLength: 120, placeholder: "e.g. Annual hackathon" },
                { key: "description", label: "Description", type: "textarea", maxLength: 600 },
              ]}
            />
          </CardContent>
        </Card>

        <Card id="faqs">
          <CardHeader>
            <CardTitle>FAQs</CardTitle>
          </CardHeader>
          <CardContent>
            <ListEditor
              action={section("faqs")}
              initial={profile.faqs}
              max={30}
              addLabel="Add question"
              emptyText="Tip: answer the questions you hear at every info session — do I need experience, how much time is it, is it in English?"
              fields={[
                { key: "question", label: "Question", maxLength: 200 },
                { key: "answer", label: "Answer", type: "textarea", maxLength: 2000 },
              ]}
            />
          </CardContent>
        </Card>

        <Card id="projects">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <ListEditor
              action={section("projects")}
              initial={profile.projects}
              max={30}
              addLabel="Add project"
              fields={[
                { key: "title", label: "Title", maxLength: 120, span: 3 },
                { key: "url", label: "Link (optional)", type: "url", placeholder: "https://", span: 3 },
                { key: "description", label: "Description", type: "textarea", maxLength: 1000 },
              ]}
            />
          </CardContent>
        </Card>

        <Card id="resources">
          <CardHeader>
            <CardTitle>Resources</CardTitle>
            <CardDescription>Links for prospective members: handbook, past presentations, Discord, newsletter …</CardDescription>
          </CardHeader>
          <CardContent>
            <ListEditor
              action={section("resources")}
              initial={profile.resources}
              max={30}
              addLabel="Add link"
              fields={[
                { key: "label", label: "Label", maxLength: 120, span: 3 },
                { key: "url", label: "Link", type: "url", placeholder: "https://", span: 3 },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
