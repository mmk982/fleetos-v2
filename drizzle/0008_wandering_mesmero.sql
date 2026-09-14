CREATE TABLE "manual_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manual_id" uuid NOT NULL,
	"revision_number" text,
	"revision_date" date,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" uuid,
	"is_current_version" boolean DEFAULT true NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"title" text NOT NULL,
	"manual_type" text,
	"department" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manual_revisions" ADD CONSTRAINT "manual_revisions_manual_id_manuals_id_fk" FOREIGN KEY ("manual_id") REFERENCES "public"."manuals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_revisions" ADD CONSTRAINT "manual_revisions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuals" ADD CONSTRAINT "manuals_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manual_revisions_manual_id_idx" ON "manual_revisions" USING btree ("manual_id");--> statement-breakpoint
CREATE INDEX "manual_revisions_is_current_idx" ON "manual_revisions" USING btree ("is_current_version");--> statement-breakpoint
CREATE INDEX "manuals_vessel_id_idx" ON "manuals" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "manuals_department_idx" ON "manuals" USING btree ("department");