"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { applications, clubClaims, clubForms, clubMembers, clubs, users } from "@/db/schema";
import { destroySession, getCurrentUser, requireAdmin, requireUser, type CurrentUser } from "@/lib/auth/session";
import { adminEmails } from "@/lib/auth/tokens";
import { appUrl, sendEmail } from "@/lib/email";

import { answersFromFormData, formatAnswer, formFieldsSchema, validateAnswers, type FormField } from "./forms";
import { APPLICATION_STATUSES, type ApplicationStatus } from "./status";

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string };

const FOOTER = "\n\n— TUM Time (unofficial student project, not affiliated with TUM)";

/** The club if the user may manage it (club member or site admin); otherwise null. */
async function managedClub(slug: string, user: CurrentUser) {
  const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug));
  if (!club) return null;
  if (user.role === "admin") return club;
  const [m] = await db
    .select()
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, user.id)));
  return m ? club : null;
}

async function clubRecipients(clubId: number, contactEmail: string | null): Promise<string[]> {
  const members = await db
    .select({ email: users.email })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(eq(clubMembers.clubId, clubId));
  return [...new Set([contactEmail, ...members.map((m) => m.email)].filter((e): e is string => !!e))];
}

async function notify(email: Parameters<typeof sendEmail>[0]) {
  try {
    await sendEmail(email);
  } catch (err) {
    // A failed notification must not fail the user's action.
    console.error("E-mail failed:", err);
  }
}

// --- Claims --------------------------------------------------------------------------------------

const claimSchema = z.object({
  position: z.string().trim().min(2, "Please tell us your role in the club.").max(120),
  message: z.string().trim().max(1000).optional(),
});

export async function submitClaim(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(`/clubs/${slug}/claim`);
  const parsed = claimSchema.safeParse({ position: formData.get("position"), message: formData.get("message") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug));
  if (!club) return { error: "Club not found." };
  const [member] = await db
    .select()
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, user.id)));
  if (member) return { error: "You already manage this club." };
  const [pending] = await db
    .select()
    .from(clubClaims)
    .where(and(eq(clubClaims.clubId, club.id), eq(clubClaims.userId, user.id), eq(clubClaims.status, "pending")));
  if (pending) return { error: "Your request is already waiting for review." };

  await db.insert(clubClaims).values({ clubId: club.id, userId: user.id, ...parsed.data });
  const admins = [...adminEmails()];
  if (admins.length) {
    await notify({
      to: admins,
      subject: `Club claim: ${club.name}`,
      text: `${user.email} (${parsed.data.position}) wants to manage "${club.name}".\n\n${parsed.data.message ?? ""}\n\nReview: ${appUrl()}/admin${FOOTER}`,
    });
  }
  return { ok: true, message: "Thanks! We'll review your request and let you know by e-mail." };
}

export async function reviewClaim(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("claimId"));
  const decision = formData.get("decision") === "approve" ? "approved" : "rejected";
  const [claim] = await db
    .update(clubClaims)
    .set({ status: decision, reviewedAt: new Date() })
    .where(and(eq(clubClaims.id, id), eq(clubClaims.status, "pending")))
    .returning();
  if (!claim) return;
  const [club] = await db.select().from(clubs).where(eq(clubs.id, claim.clubId));
  const [claimant] = await db.select().from(users).where(eq(users.id, claim.userId));
  if (decision === "approved") {
    const existing = await db.select().from(clubMembers).where(eq(clubMembers.clubId, claim.clubId));
    await db
      .insert(clubMembers)
      .values({ clubId: claim.clubId, userId: claim.userId, role: existing.length ? "admin" : "owner" })
      .onConflictDoNothing();
  }
  if (claimant && club) {
    await notify({
      to: claimant.email,
      subject: decision === "approved" ? `You can now manage ${club.name}` : `Your request for ${club.name}`,
      text:
        decision === "approved"
          ? `Your request was approved. Manage your club profile, sign-up forms and applications here:\n${appUrl()}/dashboard/${club.slug}${FOOTER}`
          : `Unfortunately we could not verify your request to manage "${club.name}". Reply to this e-mail if you think this is a mistake.${FOOTER}`,
    });
  }
  revalidatePath("/admin");
}

// --- Club profile --------------------------------------------------------------------------------

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\/\S+\.\S+$/i.test(v), "Links must start with https://")
  .transform((v) => v || null);

const profileSchema = z.object({
  description: z.string().trim().max(5000).transform((v) => v || null),
  website: optionalUrl,
  instagram: optionalUrl,
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid e-mail address")
    .transform((v) => v || null),
});

export async function updateClubProfile(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(`/dashboard/${slug}`);
  const club = await managedClub(slug, user);
  if (!club) return { error: "You don't have access to this club." };
  const parsed = profileSchema.safeParse({
    description: formData.get("description") ?? "",
    website: formData.get("website") ?? "",
    instagram: formData.get("instagram") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.update(clubs).set(parsed.data).where(eq(clubs.id, club.id));
  revalidatePath(`/clubs/${slug}`);
  return { ok: true, message: "Profile saved." };
}

// --- Sign-up forms -------------------------------------------------------------------------------

const formMetaSchema = z.object({
  title: z.string().trim().min(2, "Please give the form a title.").max(120),
  intro: z.string().trim().max(3000).transform((v) => v || null),
  status: z.enum(["draft", "open", "closed"]),
  closesAt: z
    .string()
    .trim()
    .transform((v) => (v ? new Date(`${v}T23:59:59`) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid closing date"),
});

export async function saveForm(slug: string, formId: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(`/dashboard/${slug}`);
  const club = await managedClub(slug, user);
  if (!club) return { error: "You don't have access to this club." };

  const meta = formMetaSchema.safeParse({
    title: formData.get("title") ?? "",
    intro: formData.get("intro") ?? "",
    status: formData.get("status") ?? "draft",
    closesAt: formData.get("closesAt") ?? "",
  });
  if (!meta.success) return { error: meta.error.issues[0].message };
  let fieldsJson: unknown;
  try {
    fieldsJson = JSON.parse(String(formData.get("fields") ?? "[]"));
  } catch {
    return { error: "Invalid form definition." };
  }
  const fields = formFieldsSchema.safeParse(fieldsJson);
  if (!fields.success) return { error: fields.error.issues[0].message };
  if (meta.data.status === "open" && fields.data.length === 0) return { error: "Add at least one question before opening the form." };

  const values = { ...meta.data, fields: fields.data };
  let id = formId;
  if (id) {
    const [updated] = await db
      .update(clubForms)
      .set(values)
      .where(and(eq(clubForms.id, id), eq(clubForms.clubId, club.id)))
      .returning({ id: clubForms.id });
    if (!updated) return { error: "Form not found." };
  } else {
    const [created] = await db.insert(clubForms).values({ clubId: club.id, ...values }).returning({ id: clubForms.id });
    id = created.id;
  }
  revalidatePath(`/clubs/${slug}`);
  revalidatePath("/clubs");
  if (!formId) redirect(`/dashboard/${slug}/forms/${id}?saved=1`);
  return { ok: true, message: "Form saved." };
}

export async function deleteForm(slug: string, formData: FormData) {
  const user = await requireUser(`/dashboard/${slug}`);
  const club = await managedClub(slug, user);
  if (!club) return;
  await db.delete(clubForms).where(and(eq(clubForms.id, Number(formData.get("formId"))), eq(clubForms.clubId, club.id)));
  revalidatePath(`/clubs/${slug}`);
  redirect(`/dashboard/${slug}`);
}

// --- Applications --------------------------------------------------------------------------------

export async function submitApplication(slug: string, formId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(`/clubs/${slug}/apply/${formId}`);
  const [row] = await db
    .select({ form: clubForms, club: clubs })
    .from(clubForms)
    .innerJoin(clubs, eq(clubs.id, clubForms.clubId))
    .where(and(eq(clubForms.id, formId), eq(clubs.slug, slug)));
  if (!row || row.form.status !== "open" || (row.form.closesAt && row.form.closesAt < new Date())) {
    return { error: "This form is not accepting applications." };
  }
  const name = String(formData.get("applicant_name") ?? "").trim();
  if (name.length < 2 || name.length > 120) return { fieldErrors: { applicant_name: "Please enter your name." } };
  if (formData.get("privacy") !== "on") return { fieldErrors: { privacy: "Please accept the privacy notice." } };

  const fields = row.form.fields as FormField[];
  const result = validateAnswers(fields, answersFromFormData(fields, formData));
  if (!result.ok) return { fieldErrors: result.errors, error: "Please check the highlighted fields." };

  const inserted = await db
    .insert(applications)
    .values({
      formId,
      clubId: row.club.id,
      userId: user.id,
      applicantName: name,
      applicantEmail: user.email,
      answers: result.answers,
    })
    .onConflictDoNothing()
    .returning({ id: applications.id });
  if (inserted.length === 0) return { error: "You have already applied with this form." };
  await db.update(users).set({ name }).where(eq(users.id, user.id));

  const summary = fields.map((f) => `${f.label}: ${formatAnswer(f, result.answers[f.id])}`).join("\n");
  const recipients = await clubRecipients(row.club.id, row.club.contactEmail);
  if (recipients.length) {
    await notify({
      to: recipients,
      subject: `New application: ${row.form.title}`,
      replyTo: user.email,
      text: `${name} (${user.email}) applied via "${row.form.title}".\n\n${summary}\n\nReview all applications: ${appUrl()}/dashboard/${slug}/applications${FOOTER}`,
    });
  }
  await notify({
    to: user.email,
    subject: `Your application to ${row.club.name}`,
    text: `Hi ${name},\n\nyour application to ${row.club.name} ("${row.form.title}") was sent. You can follow its status here: ${appUrl()}/me\n\nApplications are deleted automatically after 6 months.${FOOTER}`,
  });
  redirect("/me?applied=1");
}

const STATUS_MAIL: Partial<Record<ApplicationStatus, (club: string) => string>> = {
  in_review: (club) => `${club} is now reviewing your application.`,
  accepted: (club) => `Great news: ${club} accepted your application! They will get in touch with you.`,
  rejected: (club) => `${club} decided not to move forward with your application this time. Thanks for your interest!`,
};

export async function updateApplication(slug: string, formData: FormData) {
  const user = await requireUser(`/dashboard/${slug}/applications`);
  const club = await managedClub(slug, user);
  if (!club) return;
  const id = String(formData.get("applicationId"));
  const status = String(formData.get("status")) as ApplicationStatus;
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000) || null;
  if (!APPLICATION_STATUSES.includes(status)) return;

  const [before] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.clubId, club.id)));
  if (!before) return;
  await db
    .update(applications)
    .set({ status, clubNote: note, ...(status !== before.status ? { statusChangedAt: new Date() } : {}) })
    .where(eq(applications.id, id));

  const mail = STATUS_MAIL[status];
  if (status !== before.status && mail && formData.get("notify") === "on") {
    await notify({
      to: before.applicantEmail,
      subject: `Update on your application to ${club.name}`,
      text: `Hi ${before.applicantName},\n\n${mail(club.name)}\n\nSee all your applications: ${appUrl()}/me${FOOTER}`,
    });
  }
  revalidatePath(`/dashboard/${slug}/applications`);
}

// --- Own data ------------------------------------------------------------------------------------

export async function withdrawApplication(formData: FormData) {
  const user = await requireUser("/me");
  await db.delete(applications).where(and(eq(applications.id, String(formData.get("applicationId"))), eq(applications.userId, user.id)));
  revalidatePath("/me");
}

export async function deleteAccount() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  // Memberships, claims, applications and sessions are removed via ON DELETE CASCADE.
  await destroySession();
  await db.delete(users).where(eq(users.id, user.id));
  redirect("/?deleted=1");
}

export async function removeMember(slug: string, formData: FormData) {
  const user = await requireUser(`/dashboard/${slug}`);
  const club = await managedClub(slug, user);
  if (!club) return;
  const target = String(formData.get("userId"));
  await db.delete(clubMembers).where(and(eq(clubMembers.clubId, club.id), inArray(clubMembers.userId, [target])));
  revalidatePath(`/dashboard/${slug}`);
  if (target === user.id) redirect("/me");
}
