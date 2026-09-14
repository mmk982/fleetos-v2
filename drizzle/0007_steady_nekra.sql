CREATE TABLE "ism_template_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ism_template_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ism_template_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ism_template_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ism_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_code" text NOT NULL,
	"form_name" text NOT NULL,
	"category_id" uuid NOT NULL,
	"revision" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ism_templates_form_code_unique" UNIQUE("form_code")
);
--> statement-breakpoint
ALTER TABLE "ism_template_attachments" ADD CONSTRAINT "ism_template_attachments_ism_template_id_ism_templates_id_fk" FOREIGN KEY ("ism_template_id") REFERENCES "public"."ism_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ism_template_attachments" ADD CONSTRAINT "ism_template_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ism_templates" ADD CONSTRAINT "ism_templates_category_id_ism_template_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ism_template_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ism_templates_category_id_idx" ON "ism_templates" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "ism_templates_status_idx" ON "ism_templates" USING btree ("status");