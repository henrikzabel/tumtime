import { z } from "zod";

/*
 * Rich club profiles: structured facts used for filtering (time commitment, languages, audience,
 * fee, how to join) plus free-form sections the club edits (facts, activities, FAQs, projects,
 * resources, recruitment timeline) and the org chart.
 */

export const AUDIENCES = {
  bachelor: "Bachelor students",
  master: "Master students",
  phd: "PhD students",
  exchange: "Exchange students",
  beginners: "No experience needed",
  non_tum: "Students of other universities",
} as const;
export type Audience = keyof typeof AUDIENCES;

export const LANGUAGES = { en: "English", de: "German" } as const;
export type Language = keyof typeof LANGUAGES;

export const RECRUITMENT_MODES = {
  anytime: "Join any time",
  semester_start: "New members at the start of each semester",
  application: "Application rounds",
  closed: "Not recruiting at the moment",
} as const;
export type RecruitmentMode = keyof typeof RECRUITMENT_MODES;

/** Time-commitment filter buckets (hours per week). A club matches if its range overlaps. */
export const COMMITMENT_BUCKETS = [
  { value: "light", label: "≤ 2 h", min: 0, max: 2 },
  { value: "moderate", label: "3–5 h", min: 3, max: 5 },
  { value: "committed", label: "6–10 h", min: 6, max: 10 },
  { value: "intense", label: "10 h +", min: 11, max: 80 },
] as const;
export type CommitmentBucket = (typeof COMMITMENT_BUCKETS)[number]["value"];

export function matchesCommitment(hoursMin: number | null, hoursMax: number | null, bucket: CommitmentBucket): boolean {
  if (hoursMin === null && hoursMax === null) return false;
  const lo = hoursMin ?? hoursMax!;
  const hi = hoursMax ?? hoursMin!;
  const b = COMMITMENT_BUCKETS.find((x) => x.value === bucket)!;
  return lo <= b.max && hi >= b.min;
}

export function formatHours(hoursMin: number | null, hoursMax: number | null): string | null {
  if (hoursMin === null && hoursMax === null) return null;
  if (hoursMin === null || hoursMax === null || hoursMin === hoursMax) return `${hoursMin ?? hoursMax} h/week`;
  return `${hoursMin}–${hoursMax} h/week`;
}

export function formatFee(fee: number | null): string | null {
  if (fee === null) return null;
  return fee === 0 ? "Free" : `€${fee}/year`;
}

// --- Free-form profile sections ----------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max);
const required = (max: number, what: string) => z.string().trim().min(1, `${what} can't be empty`).max(max);
const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+\.\S+$/i.test(v), "Links must start with https://");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date");

export const MILESTONE_KINDS = {
  info: "Info session / open event",
  deadline: "Application deadline",
  interview: "Interviews / selection",
  kickoff: "Kick-off / onboarding",
  other: "Other",
} as const;
export type MilestoneKind = keyof typeof MILESTONE_KINDS;

export const clubProfileSchema = z.object({
  /** Big-number tiles like "5 — general meetings per semester". */
  facts: z.array(z.object({ value: required(24, "Value"), label: required(120, "Label") })).max(12).default([]),
  /** What the club regularly does ("Events they host", recurring formats, trips …). */
  activities: z.array(z.object({ title: required(120, "Title"), description: text(600) })).max(20).default([]),
  faqs: z.array(z.object({ question: required(200, "Question"), answer: required(2000, "Answer") })).max(30).default([]),
  projects: z
    .array(z.object({ title: required(120, "Title"), description: text(1000), url: url.default("") }))
    .max(30)
    .default([]),
  resources: z.array(z.object({ label: required(120, "Label"), url: url.refine((v) => v !== "", "Add a link") })).max(30).default([]),
  /** Recruitment milestones besides info sessions and form deadlines, which are added automatically. */
  timeline: z
    .array(
      z.object({
        date: isoDate,
        title: required(80, "Title"),
        detail: text(120).default(""),
        kind: z.enum(Object.keys(MILESTONE_KINDS) as [MilestoneKind, ...MilestoneKind[]]).default("other"),
      }),
    )
    .max(20)
    .default([]),
  /** Label shown next to the timeline, e.g. "Winter 2026/27". */
  timelineTerm: text(40).default(""),
});
export type ClubProfile = z.infer<typeof clubProfileSchema>;
export type ProfileSection = Exclude<keyof ClubProfile, "timelineTerm">;

/** Parse stored JSON leniently: an invalid section is dropped instead of breaking the page. */
export function readProfile(raw: unknown): ClubProfile {
  const parsed = clubProfileSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = clubProfileSchema.parse({});
  for (const key of Object.keys(out) as (keyof ClubProfile)[]) {
    const one = clubProfileSchema.shape[key].safeParse(obj[key]);
    if (one.success) (out as Record<string, unknown>)[key] = one.data;
  }
  return out;
}

// --- Org chart --------------------------------------------------------------------------------

export const MAX_ROLES = 80;

export const roleSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{4,24}$/),
  parentId: z.string().nullable(),
  title: required(80, "Role title"),
  /** Name(s) of the people holding the role; empty = vacant. */
  holder: text(120).default(""),
  description: text(300).default(""),
  /** The club is looking for someone for this role / team. */
  open: z.boolean().default(false),
});
export type ClubRole = z.infer<typeof roleSchema>;

export const clubStructureSchema = z
  .array(roleSchema)
  .max(MAX_ROLES, `At most ${MAX_ROLES} roles`)
  .superRefine((roles, ctx) => {
    const ids = new Set<string>();
    for (const r of roles) {
      if (ids.has(r.id)) ctx.addIssue({ code: "custom", message: "Duplicate role id" });
      ids.add(r.id);
    }
    for (const r of roles) {
      if (r.parentId !== null && !ids.has(r.parentId)) ctx.addIssue({ code: "custom", message: `"${r.title}" reports to a deleted role` });
    }
    // Following parents from any role must end at a root, never loop.
    const byId = new Map(roles.map((r) => [r.id, r]));
    for (const r of roles) {
      const seen = new Set<string>();
      let cur: ClubRole | undefined = r;
      while (cur?.parentId) {
        if (seen.has(cur.id)) {
          ctx.addIssue({ code: "custom", message: "The hierarchy contains a loop" });
          return;
        }
        seen.add(cur.id);
        cur = byId.get(cur.parentId);
      }
    }
  });

export function readStructure(raw: unknown): ClubRole[] {
  const parsed = clubStructureSchema.safeParse(raw ?? []);
  return parsed.success ? parsed.data : [];
}

export type RoleNode = ClubRole & { children: RoleNode[] };

/** Build the tree, keeping the stored order among siblings. */
export function roleTree(roles: ClubRole[]): RoleNode[] {
  const nodes = new Map<string, RoleNode>(roles.map((r) => [r.id, { ...r, children: [] }]));
  const roots: RoleNode[] = [];
  for (const r of roles) {
    const node = nodes.get(r.id)!;
    const parent = r.parentId ? nodes.get(r.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Ids of a role and everything below it. */
export function descendantIds(roles: ClubRole[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of roles) {
      if (r.parentId && out.has(r.parentId) && !out.has(r.id)) {
        out.add(r.id);
        grew = true;
      }
    }
  }
  return out;
}

export const newRoleId = () => Math.random().toString(36).slice(2, 10).padEnd(6, "0");

export function defaultStructure(): ClubRole[] {
  const board = newRoleId();
  return [
    { id: board, parentId: null, title: "President", holder: "", description: "", open: false },
    { id: newRoleId(), parentId: board, title: "Vice President", holder: "", description: "", open: false },
    { id: newRoleId(), parentId: board, title: "Treasurer", holder: "", description: "", open: false },
  ];
}
