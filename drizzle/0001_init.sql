CREATE TYPE "public"."data_source" AS ENUM('aamin', 'tum_info', 'upload');--> statement-breakpoint
CREATE TYPE "public"."exam_status" AS ENUM('published', 'conflict', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."exam_type" AS ENUM('endterm', 'retake');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_de" text,
	"module_prefixes" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" integer NOT NULL,
	"semester" text NOT NULL,
	"semester_key" smallint NOT NULL,
	"type" "exam_type" NOT NULL,
	"date" date,
	"registered" integer,
	"attempted" integer,
	"passed" integer,
	"failed" integer,
	"no_show" integer,
	"withdrawn" integer,
	"cheating" integer,
	"average_total" numeric(4, 3),
	"average_passed" numeric(4, 3),
	"failure_rate" numeric(5, 4),
	"status" "exam_status" DEFAULT 'published' NOT NULL,
	"pinned_source" "data_source",
	"sources" "data_source"[] DEFAULT '{}'::data_source[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exams_module_semester_type" UNIQUE("module_id","semester","type"),
	CONSTRAINT "exams_semester_format" CHECK ("exams"."semester" ~ '^[0-9]{4}(WS|SS)$')
);
--> statement-breakpoint
CREATE TABLE "grade_counts" (
	"exam_id" integer NOT NULL,
	"grade" text NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "grade_counts_exam_id_grade_pk" PRIMARY KEY("exam_id","grade"),
	CONSTRAINT "grade_counts_grade_format" CHECK ("grade_counts"."grade" ~ '^([1-5]\.[0-9]|B|N)$'),
	CONSTRAINT "grade_counts_count_nonneg" CHECK ("grade_counts"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "module_names" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" integer NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"first_semester" text,
	"last_semester" text,
	CONSTRAINT "module_names_unique" UNIQUE("module_id","lang","name")
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_en" text,
	"name_de" text,
	"ects" numeric(4, 1),
	"school_id" integer,
	"department_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_de" text,
	CONSTRAINT "schools_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "data_source" NOT NULL,
	"external_id" text NOT NULL,
	"module_code" text NOT NULL,
	"semester" text NOT NULL,
	"type" "exam_type" NOT NULL,
	"data" jsonb NOT NULL,
	"exam_id" integer,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_records_source_key" UNIQUE("source","module_code","semester","type")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"module_code" text NOT NULL,
	"semester" text NOT NULL,
	"type" "exam_type" NOT NULL,
	"data" jsonb NOT NULL,
	"parser_version" text NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_counts" ADD CONSTRAINT "grade_counts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_names" ADD CONSTRAINT "module_names_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exams_semester_key_idx" ON "exams" USING btree ("semester_key");--> statement-breakpoint
CREATE INDEX "module_names_name_trgm" ON "module_names" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "modules_code_trgm" ON "modules" USING gin ("code" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "modules_name_en_trgm" ON "modules" USING gin ("name_en" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "modules_name_de_trgm" ON "modules" USING gin ("name_de" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "modules_department_idx" ON "modules" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "source_records_key_idx" ON "source_records" USING btree ("module_code","semester","type");