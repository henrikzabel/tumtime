CREATE TABLE "course_events" (
	"id" bigint PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"canceled" boolean DEFAULT false NOT NULL,
	"type" text,
	"room_short" text,
	"room_code" text,
	"room_nav_url" text,
	"room_description" text
);
--> statement-breakpoint
CREATE TABLE "course_groups" (
	"id" bigint PRIMARY KEY NOT NULL,
	"course_id" bigint NOT NULL,
	"name" text NOT NULL,
	"max_students" integer
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"course_id" bigint NOT NULL,
	"module_code" text NOT NULL,
	CONSTRAINT "course_modules_course_id_module_code_pk" PRIMARY KEY("course_id","module_code")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" bigint PRIMARY KEY NOT NULL,
	"semester" text NOT NULL,
	"title_de" text,
	"title_en" text,
	"activity" text,
	"activity_name" text,
	"hours_per_week" numeric(4, 1),
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"tumonline_url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_descriptions" (
	"module_id" integer PRIMARY KEY NOT NULL,
	"credits" numeric(4, 1),
	"cycle" text,
	"duration_semesters" smallint,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"level" text,
	"exam_repeat" text,
	"content_de" text,
	"content_en" text,
	"outcome_de" text,
	"outcome_en" text,
	"precondition_de" text,
	"precondition_en" text,
	"exam_de" text,
	"exam_en" text,
	"contact_hours" smallint,
	"organisation" text,
	"description_version" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"study_id" text NOT NULL,
	"slug" text NOT NULL,
	"name_de" text NOT NULL,
	"name_en" text NOT NULL,
	"degree" text NOT NULL,
	"school_id" integer,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programs_study_id_unique" UNIQUE("study_id"),
	CONSTRAINT "programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "study_plan_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"study_plan_id" integer NOT NULL,
	"semester_no" smallint NOT NULL,
	"kind" text NOT NULL,
	"module_code" text,
	"title" text NOT NULL,
	"credits" numeric(4, 1) NOT NULL,
	"area" text,
	"markers" text DEFAULT '' NOT NULL,
	"alternative_group" smallint,
	"sort" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"title" text NOT NULL,
	"start_from" text,
	"start_until" text,
	"tumonline_curriculum_id" integer,
	"footnotes" text[] DEFAULT '{}'::text[] NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_plans_program_title" UNIQUE("program_id","title")
);
--> statement-breakpoint
ALTER TABLE "course_events" ADD CONSTRAINT "course_events_group_id_course_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."course_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_groups" ADD CONSTRAINT "course_groups_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_descriptions" ADD CONSTRAINT "module_descriptions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan_entries" ADD CONSTRAINT "study_plan_entries_study_plan_id_study_plans_id_fk" FOREIGN KEY ("study_plan_id") REFERENCES "public"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_events_group_idx" ON "course_events" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "course_groups_course_idx" ON "course_groups" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_modules_code_idx" ON "course_modules" USING btree ("module_code");--> statement-breakpoint
CREATE INDEX "courses_semester_idx" ON "courses" USING btree ("semester");--> statement-breakpoint
CREATE INDEX "study_plan_entries_plan_idx" ON "study_plan_entries" USING btree ("study_plan_id");