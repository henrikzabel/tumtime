import { z } from "zod";

import { parseSemester, type Semester } from "@/lib/stats/semester";
import { decodeHtmlEntities } from "@/lib/text";

/**
 * Parsers for the public TUM NAT API (https://api.srv.nat.tum.de/docs):
 *   /api/v1/mhb/module/{code}  – module handbook entry
 *   /api/v1/course/{id}         – course incl. groups, events (dates/rooms) and linked modules
 * Staff names and e-mail addresses in these responses are deliberately ignored.
 */
export const NAT_API = "https://api.srv.nat.tum.de/api/v1";

const label = z.object({ title: z.string().nullish(), title_en: z.string().nullish(), short: z.string().nullish() });
const text = (v: string | null | undefined) => (v ? decodeHtmlEntities(v).trim() || null : null);

const natModuleSchema = z.object({
  module_code: z.string(),
  module_title: z.string().nullish(),
  module_title_en: z.string().nullish(),
  module_credits: z.union([z.number(), z.string()]).nullish(),
  description_version: z.string().nullish(),
  module_levels: z.array(label).nullish(),
  module_languages: z.array(label).nullish(),
  module_cycle: label.nullish(),
  module_duration: label.nullish(),
  module_examrepeat: z.array(label).nullish(),
  module_content: z.string().nullish(),
  module_content_en: z.string().nullish(),
  module_outcome: z.string().nullish(),
  module_outcome_en: z.string().nullish(),
  module_precondition: z.string().nullish(),
  module_precondition_en: z.string().nullish(),
  module_exam: z.string().nullish(),
  module_exam_en: z.string().nullish(),
  description_workload_praesenz: z.number().nullish(),
  org: z.object({ org_name_en: z.string().nullish(), org_name: z.string().nullish() }).nullish(),
});

export type ModuleCycle = "winter" | "summer" | "both";

export type ModuleDescription = {
  moduleCode: string;
  titleDe: string | null;
  titleEn: string | null;
  credits: number | null;
  /** When the module is offered. */
  cycle: ModuleCycle | null;
  durationSemesters: number | null;
  languages: string[];
  level: string | null;
  examRepeat: string | null;
  contentDe: string | null;
  contentEn: string | null;
  outcomeDe: string | null;
  outcomeEn: string | null;
  preconditionDe: string | null;
  preconditionEn: string | null;
  examDe: string | null;
  examEn: string | null;
  contactHours: number | null;
  organisation: string | null;
  descriptionVersion: string | null;
};

export function parseCycle(cycle: z.infer<typeof label> | null | undefined): ModuleCycle | null {
  if (!cycle) return null;
  const s = `${cycle.short ?? ""} ${cycle.title_en ?? ""} ${cycle.title ?? ""}`.toLowerCase();
  const winter = /\bw\b|winter/.test(s);
  const summer = /\bs\b|summer|sommer/.test(s);
  if (/winter and summer|summer and winter|winter- und sommer|sommer- und winter|jedes semester|each semester|every semester/.test(s))
    return "both";
  if (winter && summer) return "both";
  if (winter) return "winter";
  if (summer) return "summer";
  return null;
}

export function parseNatModule(raw: unknown): ModuleDescription {
  const m = natModuleSchema.parse(raw);
  const credits = m.module_credits === null || m.module_credits === undefined ? null : Number(m.module_credits);
  const duration = Number(m.module_duration?.short);
  return {
    moduleCode: m.module_code.trim().toUpperCase(),
    titleDe: text(m.module_title),
    titleEn: text(m.module_title_en),
    credits: Number.isFinite(credits) ? credits : null,
    cycle: parseCycle(m.module_cycle),
    durationSemesters: Number.isFinite(duration) && duration > 0 ? duration : null,
    languages: (m.module_languages ?? []).map((l) => (l.short ?? l.title_en ?? "").toUpperCase()).filter(Boolean),
    level: m.module_levels?.[0]?.title_en ?? null,
    examRepeat: m.module_examrepeat?.[0]?.title_en ?? null,
    contentDe: text(m.module_content),
    contentEn: text(m.module_content_en),
    outcomeDe: text(m.module_outcome),
    outcomeEn: text(m.module_outcome_en),
    preconditionDe: text(m.module_precondition),
    preconditionEn: text(m.module_precondition_en),
    examDe: text(m.module_exam),
    examEn: text(m.module_exam_en),
    contactHours: m.description_workload_praesenz ?? null,
    organisation: m.org?.org_name_en ?? m.org?.org_name ?? null,
    descriptionVersion: m.description_version ?? null,
  };
}

const natEventSchema = z.object({
  event_id: z.number(),
  start: z.string(),
  end: z.string(),
  eventtype: z.object({ eventtype_id: z.string().nullish(), eventtype_en: z.string().nullish() }).nullish(),
  eventstatus: z.object({ canceled: z.boolean().nullish() }).nullish(),
  room: z
    .object({
      room_short: z.string().nullish(),
      room_code: z.string().nullish(),
      nav_url: z.string().nullish(),
      description: z.string().nullish(),
    })
    .nullish(),
});

const natCourseSchema = z.object({
  course_id: z.number(),
  course_name: z.string().nullish(),
  course_name_en: z.string().nullish(),
  hoursperweek: z.union([z.string(), z.number()]).nullish(),
  activity: z.object({ activity_id: z.string(), activity_name_en: z.string().nullish() }).nullish(),
  semester: z.object({ semester_key: z.string() }),
  instruction_languages: z.array(z.string()).nullish(),
  tumonline_url: z.string().nullish(),
  modules: z.array(z.object({ module_code: z.string() })).nullish(),
  groups: z
    .array(
      z.object({
        group_id: z.number(),
        group_name: z.string().nullish(),
        max_students: z.number().nullish(),
        events: z.array(natEventSchema).nullish(),
      }),
    )
    .nullish(),
});

export type CourseEvent = {
  id: number;
  start: string;
  end: string;
  canceled: boolean;
  /** e.g. "REGULAR"; exams and one-off appointments have other types. */
  type: string | null;
  room: { short: string | null; code: string | null; navUrl: string | null; description: string | null } | null;
};

export type CourseGroup = { id: number; name: string; maxStudents: number | null; events: CourseEvent[] };

export type Course = {
  id: number;
  semester: Semester;
  titleDe: string | null;
  titleEn: string | null;
  /** TUMonline activity code: VO lecture, UE exercise, VI lecture+exercise, PR lab, SE seminar … */
  activity: string | null;
  activityName: string | null;
  hoursPerWeek: number | null;
  languages: string[];
  moduleCodes: string[];
  tumonlineUrl: string | null;
  groups: CourseGroup[];
};

export function parseNatCourse(raw: unknown): Course {
  const c = natCourseSchema.parse(raw);
  const semester = parseSemester(c.semester.semester_key);
  if (!semester) throw new Error(`Unknown semester "${c.semester.semester_key}"`);
  const hours = Number(c.hoursperweek);
  return {
    id: c.course_id,
    semester,
    titleDe: text(c.course_name),
    titleEn: text(c.course_name_en),
    activity: c.activity?.activity_id ?? null,
    activityName: c.activity?.activity_name_en ?? null,
    hoursPerWeek: Number.isFinite(hours) ? hours : null,
    languages: (c.instruction_languages ?? []).map((l) => l.toUpperCase()),
    moduleCodes: [...new Set((c.modules ?? []).map((m) => m.module_code.trim().toUpperCase()))],
    tumonlineUrl: c.tumonline_url ?? null,
    groups: (c.groups ?? []).map((g) => ({
      id: g.group_id,
      name: text(g.group_name) ?? "Group",
      maxStudents: g.max_students ?? null,
      events: (g.events ?? []).map((e) => ({
        id: e.event_id,
        start: e.start,
        end: e.end,
        canceled: e.eventstatus?.canceled ?? false,
        type: e.eventtype?.eventtype_id ?? null,
        room: e.room
          ? {
              short: e.room.room_short ?? null,
              code: e.room.room_code ?? null,
              navUrl: e.room.nav_url ?? null,
              description: e.room.description ?? null,
            }
          : null,
      })),
    })),
  };
}

/** Module codes mentioned in a course title, e.g. "Übungen zu Diskrete Strukturen (IN0015)". */
export function moduleCodesInTitle(title: string): string[] {
  return [...new Set([...title.matchAll(/\b([A-Z]{2,5}\d{4,7}(?:_[A-Z0-9]+)?)\b/g)].map((m) => m[1]))];
}
