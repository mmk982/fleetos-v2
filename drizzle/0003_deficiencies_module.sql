CREATE TABLE "deficiencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"deficiency_number" text,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reference" text,
	"identified_date" date,
	"due_date" date,
	"closed_date" date,
	"corrective_action" text,
	"responsible_person" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deficiency_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deficiency_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deficiencies" ADD CONSTRAINT "deficiencies_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deficiency_attachments" ADD CONSTRAINT "deficiency_attachments_deficiency_id_deficiencies_id_fk" FOREIGN KEY ("deficiency_id") REFERENCES "public"."deficiencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deficiency_attachments" ADD CONSTRAINT "deficiency_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deficiencies_vessel_id_idx" ON "deficiencies" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "deficiencies_status_idx" ON "deficiencies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deficiencies_due_date_idx" ON "deficiencies" USING btree ("due_date");