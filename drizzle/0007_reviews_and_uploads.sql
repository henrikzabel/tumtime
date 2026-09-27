CREATE TABLE "module_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" integer NOT NULL,
	"semester" text NOT NULL,
	"usefulness" smallint NOT NULL,
	"difficulty" smallint NOT NULL,
	"workload" smallint NOT NULL,
	"attendance_required" boolean,
	"lectures_recorded" boolean,
	"comment" text,
	"comment_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_reviews_user_module_semester" UNIQUE("user_id","module_id","semester"),
	CONSTRAINT "module_reviews_semester_format" CHECK ("module_reviews"."semester" ~ '^[0-9]{4}(WS|SS)$'),
	CONSTRAINT "module_reviews_ratings_range" CHECK ("module_reviews"."usefulness" between 1 and 5 and "module_reviews"."difficulty" between 1 and 5 and "module_reviews"."workload" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "warnings" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "module_reviews" ADD CONSTRAINT "module_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_reviews" ADD CONSTRAINT "module_reviews_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "module_reviews_module_idx" ON "module_reviews" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "module_reviews_comment_status_idx" ON "module_reviews" USING btree ("comment_status");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "submissions_user_idx" ON "submissions" USING btree ("user_id");