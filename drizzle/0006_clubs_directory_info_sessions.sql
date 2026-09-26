CREATE TABLE "info_session_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"weekdays" smallint[] DEFAULT '{1,2,3,4}'::smallint[] NOT NULL,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"venues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "info_session_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_id" integer NOT NULL,
	"club_id" integer NOT NULL,
	"preferred_dates" text[] DEFAULT '{}'::text[] NOT NULL,
	"avoid_dates" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_times" text[] DEFAULT '{}'::text[] NOT NULL,
	"campus" text,
	"language" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "info_session_requests_period_club" UNIQUE("period_id","club_id")
);
--> statement-breakpoint
CREATE TABLE "info_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"period_id" integer,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"venue" text,
	"campus" text,
	"online_url" text,
	"language" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "info_sessions_period_slot" UNIQUE("period_id","starts_at","venue")
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "linkedin" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "founded_year" smallint;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "member_count" integer;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "hours_min" smallint;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "hours_max" smallint;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "languages" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "audience" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "fee_euros" integer;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "recruitment" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "structure" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "info_session_requests" ADD CONSTRAINT "info_session_requests_period_id_info_session_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."info_session_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "info_session_requests" ADD CONSTRAINT "info_session_requests_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "info_sessions" ADD CONSTRAINT "info_sessions_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "info_sessions" ADD CONSTRAINT "info_sessions_period_id_info_session_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."info_session_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "info_sessions_club_idx" ON "info_sessions" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "info_sessions_starts_idx" ON "info_sessions" USING btree ("starts_at");