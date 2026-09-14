CREATE TABLE "monthly_executed_form_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executed_form_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_executed_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"ism_template_id" uuid,
	"form_name" text NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"uploaded_at" timestamp with time zone,
	"uploaded_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_form_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"ism_template_id" uuid NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"active_status" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monthly_executed_form_attachments" ADD CONSTRAINT "monthly_executed_form_attachments_executed_form_id_monthly_executed_forms_id_fk" FOREIGN KEY ("executed_form_id") REFERENCES "public"."monthly_executed_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_executed_form_attachments" ADD CONSTRAINT "monthly_executed_form_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_executed_forms" ADD CONSTRAINT "monthly_executed_forms_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_executed_forms" ADD CONSTRAINT "monthly_executed_forms_ism_template_id_ism_templates_id_fk" FOREIGN KEY ("ism_template_id") REFERENCES "public"."ism_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_executed_forms" ADD CONSTRAINT "monthly_executed_forms_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_form_requirements" ADD CONSTRAINT "monthly_form_requirements_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_form_requirements" ADD CONSTRAINT "monthly_form_requirements_ism_template_id_ism_templates_id_fk" FOREIGN KEY ("ism_template_id") REFERENCES "public"."ism_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_executed_forms_vessel_template_period_uidx" ON "monthly_executed_forms" USING btree ("vessel_id","ism_template_id","month","year");--> statement-breakpoint
CREATE INDEX "monthly_executed_forms_vessel_id_idx" ON "monthly_executed_forms" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "monthly_executed_forms_period_idx" ON "monthly_executed_forms" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "monthly_executed_forms_status_idx" ON "monthly_executed_forms" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_form_requirements_vessel_template_uidx" ON "monthly_form_requirements" USING btree ("vessel_id","ism_template_id");--> statement-breakpoint
CREATE INDEX "monthly_form_requirements_vessel_id_idx" ON "monthly_form_requirements" USING btree ("vessel_id");