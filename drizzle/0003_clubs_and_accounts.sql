CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" integer NOT NULL,
	"club_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"applicant_name" text NOT NULL,
	"applicant_email" text NOT NULL,
	"answers" jsonb NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"club_note" text,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_form_user" UNIQUE("form_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "club_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"position" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "club_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"title" text NOT NULL,
	"intro" text,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"closes_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_members" (
	"club_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_members_club_id_user_id_pk" PRIMARY KEY("club_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"source_description" text,
	"description" text,
	"focus_areas" text[] DEFAULT '{}'::text[] NOT NULL,
	"locations" text[] DEFAULT '{}'::text[] NOT NULL,
	"website" text,
	"image_url" text,
	"contact_email" text,
	"instagram" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"listed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug"),
	CONSTRAINT "clubs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"redirect_to" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'student' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_form_id_club_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."club_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_claims" ADD CONSTRAINT "club_claims_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_claims" ADD CONSTRAINT "club_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_forms" ADD CONSTRAINT "club_forms_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_club_idx" ON "applications" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "applications_user_idx" ON "applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "applications_created_idx" ON "applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "club_claims_status_idx" ON "club_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "club_forms_club_idx" ON "club_forms" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "clubs_name_trgm" ON "clubs" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "login_tokens_email_idx" ON "login_tokens" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");