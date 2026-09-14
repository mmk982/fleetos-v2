CREATE TABLE "insurance_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insurance_policy_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"policy_type" text NOT NULL,
	"provider" text,
	"policy_number" text,
	"coverage_amount" integer,
	"currency" text,
	"start_date" date,
	"expiry_date" date,
	"cached_status" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insurance_attachments" ADD CONSTRAINT "insurance_attachments_insurance_policy_id_insurance_policies_id_fk" FOREIGN KEY ("insurance_policy_id") REFERENCES "public"."insurance_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_attachments" ADD CONSTRAINT "insurance_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "insurance_policies_vessel_id_idx" ON "insurance_policies" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "insurance_policies_policy_type_idx" ON "insurance_policies" USING btree ("policy_type");--> statement-breakpoint
CREATE INDEX "insurance_policies_expiry_date_idx" ON "insurance_policies" USING btree ("expiry_date");