import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Data model
 * ----------
 * `modules` is the central, stable entity (keyed by the TUM module number). Phase 1 attaches exam
 * statistics to it; later phases (study planner, study-abroad recognitions) will reference
 * `modules.id` as well.
 *
 * Statistics flow in two layers:
 *   source_records  — one row per exam *per source* (TUM Info, aamin export, student upload),
 *                     stored as normalised JSON exactly as that source reported it.
 *   exams + grade_counts — the merged, public view, rebuilt from source_records by the merge
 *                     step. Removing a source = deleting its source_records and re-merging.
 */

export const examType = pgEnum("exam_type", ["endterm", "retake"]);
export const examStatus = pgEnum("exam_status", [
  "published", // visible on the site
  "conflict", // sources disagree — hidden until an admin picks a source
  "hidden", // manually hidden by an admin
]);
export const dataSource = pgEnum("data_source", ["aamin", "tum_info", "upload"]);
export const submissionStatus = pgEnum("submission_status", ["pending", "approved", "rejected"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. "CIT"
  nameEn: text("name_en").notNull(),
  nameDe: text("name_de"),
});

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id),
  code: text("code").notNull().unique(), // e.g. "IN"
  nameEn: text("name_en").notNull(),
  nameDe: text("name_de"),
  // Module-number prefixes that belong to this department, e.g. {"IN"} or {"LRG","LR"}.
  modulePrefixes: text("module_prefixes").array().notNull().default(sql`'{}'::text[]`),
});

export const modules = pgTable(
  "modules",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // TUM module number, e.g. "IN0001" — the stable ID
    nameEn: text("name_en"),
    nameDe: text("name_de"),
    ects: numeric("ects", { precision: 4, scale: 1, mode: "number" }),
    schoolId: integer("school_id").references(() => schools.id),
    departmentId: integer("department_id").references(() => departments.id),
    ...timestamps,
  },
  (t) => [
    index("modules_code_trgm").using("gin", sql`${t.code} gin_trgm_ops`),
    index("modules_name_en_trgm").using("gin", sql`${t.nameEn} gin_trgm_ops`),
    index("modules_name_de_trgm").using("gin", sql`${t.nameDe} gin_trgm_ops`),
    index("modules_department_idx").on(t.departmentId),
  ],
);

/** Module names change over the years; keep every name we have seen, with the semesters it was used. */
export const moduleNames = pgTable(
  "module_names",
  {
    id: serial("id").primaryKey(),
    moduleId: integer("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(), // "en" | "de"
    name: text("name").notNull(),
    firstSemester: text("first_semester"),
    lastSemester: text("last_semester"),
  },
  (t) => [
    unique("module_names_unique").on(t.moduleId, t.lang, t.name),
    index("module_names_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
  ],
);

export const exams = pgTable(
  "exams",
  {
    id: serial("id").primaryKey(),
    moduleId: integer("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    semester: text("semester").notNull(), // "2024WS" | "2025SS"
    semesterKey: smallint("semester_key").notNull(), // sortable: year * 2 (+1 for WS)
    type: examType("type").notNull(),
    date: date("date"),
    registered: integer("registered"),
    attempted: integer("attempted"),
    passed: integer("passed"),
    failed: integer("failed"),
    noShow: integer("no_show"),
    withdrawn: integer("withdrawn"),
    cheating: integer("cheating"),
    averageTotal: numeric("average_total", { precision: 4, scale: 3, mode: "number" }),
    averagePassed: numeric("average_passed", { precision: 4, scale: 3, mode: "number" }),
    failureRate: numeric("failure_rate", { precision: 5, scale: 4, mode: "number" }), // 0..1
    status: examStatus("status").notNull().default("published"),
    // Admin override when sources conflict: use this source's numbers.
    pinnedSource: dataSource("pinned_source"),
    sources: dataSource("sources").array().notNull().default(sql`'{}'::data_source[]`),
    ...timestamps,
  },
  (t) => [
    unique("exams_module_semester_type").on(t.moduleId, t.semester, t.type),
    index("exams_semester_key_idx").on(t.semesterKey),
    check("exams_semester_format", sql`${t.semester} ~ '^[0-9]{4}(WS|SS)$'`),
  ],
);

/** Graded outcomes only: "1.0"…"5.0" (incl. steps like "1.4"), "B" (passed) and "N" (failed). */
export const gradeCounts = pgTable(
  "grade_counts",
  {
    examId: integer("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    grade: text("grade").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.examId, t.grade] }),
    check("grade_counts_grade_format", sql`${t.grade} ~ '^([1-5]\\.[0-9]|B|N)$'`),
    check("grade_counts_count_nonneg", sql`${t.count} >= 0`),
  ],
);

/** One normalised exam record per source. See `ExamRecord` in src/lib/exam-record.ts for `data`. */
export const sourceRecords = pgTable(
  "source_records",
  {
    id: serial("id").primaryKey(),
    source: dataSource("source").notNull(),
    externalId: text("external_id").notNull(),
    moduleCode: text("module_code").notNull(),
    semester: text("semester").notNull(),
    type: examType("type").notNull(),
    data: jsonb("data").notNull(),
    examId: integer("exam_id").references(() => exams.id, { onDelete: "set null" }),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("source_records_source_key").on(t.source, t.moduleCode, t.semester, t.type),
    index("source_records_key_idx").on(t.moduleCode, t.semester, t.type),
  ],
);

/**
 * Student uploads awaiting moderation. Only the *parsed, aggregated* numbers are stored — never the
 * uploaded HTML, which contains the uploader's name.
 */
export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: submissionStatus("status").notNull().default("pending"),
  moduleCode: text("module_code").notNull(),
  semester: text("semester").notNull(),
  type: examType("type").notNull(),
  data: jsonb("data").notNull(),
  parserVersion: text("parser_version").notNull(),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------------------------------------
 * Phase 2: study planner & timetable
 *
 * programs → study_plans (one per starting cohort, from the CIT "Studienplan" pages)
 *          → study_plan_entries (recommended modules / elective placeholders per semester)
 * module_descriptions: module handbook details (TUM NAT API), 1:1 with modules
 * courses → course_groups → course_events: lectures/tutorials with dates and rooms per semester;
 * course_modules links courses to module numbers.
 * --------------------------------------------------------------------------------------------- */

export const programs = pgTable("programs", {
  id: serial("id").primaryKey(),
  studyId: text("study_id").notNull().unique(), // TUMonline study id, e.g. "163017030"
  slug: text("slug").notNull().unique(), // URL-friendly, e.g. "bsc-informatics"
  nameDe: text("name_de").notNull(),
  nameEn: text("name_en").notNull(),
  degree: text("degree").notNull(), // "B.Sc."
  schoolId: integer("school_id").references(() => schools.id),
  sourceUrl: text("source_url"),
  ...timestamps,
});

export const studyPlans = pgTable(
  "study_plans",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startFrom: text("start_from"), // first starting semester this plan applies to
    startUntil: text("start_until"), // last starting semester (null = still current)
    tumonlineCurriculumId: integer("tumonline_curriculum_id"),
    footnotes: text("footnotes").array().notNull().default(sql`'{}'::text[]`),
    requirements: jsonb("requirements").notNull().default(sql`'[]'::jsonb`), // [{ area, credits }]
    sort: smallint("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [unique("study_plans_program_title").on(t.programId, t.title)],
);

export const studyPlanEntries = pgTable(
  "study_plan_entries",
  {
    id: serial("id").primaryKey(),
    studyPlanId: integer("study_plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    semesterNo: smallint("semester_no").notNull(),
    kind: text("kind").notNull(), // "module" | "placeholder"
    moduleCode: text("module_code"),
    title: text("title").notNull(),
    credits: numeric("credits", { precision: 4, scale: 1, mode: "number" }).notNull(),
    area: text("area"),
    markers: text("markers").notNull().default(""),
    alternativeGroup: smallint("alternative_group"),
    sort: smallint("sort").notNull().default(0),
  },
  (t) => [index("study_plan_entries_plan_idx").on(t.studyPlanId)],
);

export const moduleDescriptions = pgTable("module_descriptions", {
  moduleId: integer("module_id")
    .primaryKey()
    .references(() => modules.id, { onDelete: "cascade" }),
  credits: numeric("credits", { precision: 4, scale: 1, mode: "number" }),
  cycle: text("cycle"), // "winter" | "summer" | "both"
  durationSemesters: smallint("duration_semesters"),
  languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
  level: text("level"),
  examRepeat: text("exam_repeat"),
  contentDe: text("content_de"),
  contentEn: text("content_en"),
  outcomeDe: text("outcome_de"),
  outcomeEn: text("outcome_en"),
  preconditionDe: text("precondition_de"),
  preconditionEn: text("precondition_en"),
  examDe: text("exam_de"),
  examEn: text("exam_en"),
  contactHours: smallint("contact_hours"),
  organisation: text("organisation"),
  descriptionVersion: text("description_version"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courses = pgTable(
  "courses",
  {
    id: bigint("id", { mode: "number" }).primaryKey(), // TUMonline course id
    semester: text("semester").notNull(),
    titleDe: text("title_de"),
    titleEn: text("title_en"),
    activity: text("activity"), // VO, UE, VI, PR, SE …
    activityName: text("activity_name"),
    hoursPerWeek: numeric("hours_per_week", { precision: 4, scale: 1, mode: "number" }),
    languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
    tumonlineUrl: text("tumonline_url"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("courses_semester_idx").on(t.semester)],
);

export const courseModules = pgTable(
  "course_modules",
  {
    courseId: bigint("course_id", { mode: "number" })
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    moduleCode: text("module_code").notNull(),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.moduleCode] }), index("course_modules_code_idx").on(t.moduleCode)],
);

export const courseGroups = pgTable(
  "course_groups",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    courseId: bigint("course_id", { mode: "number" })
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    maxStudents: integer("max_students"),
  },
  (t) => [index("course_groups_course_idx").on(t.courseId)],
);

export const courseEvents = pgTable(
  "course_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    groupId: bigint("group_id", { mode: "number" })
      .notNull()
      .references(() => courseGroups.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    canceled: boolean("canceled").notNull().default(false),
    type: text("type"),
    roomShort: text("room_short"),
    roomCode: text("room_code"),
    roomNavUrl: text("room_nav_url"),
    roomDescription: text("room_description"),
  },
  (t) => [index("course_events_group_idx").on(t.groupId)],
);
