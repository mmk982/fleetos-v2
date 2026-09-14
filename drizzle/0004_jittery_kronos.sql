CREATE TABLE "crew_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crew_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "crew_certificate_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crew_certificate_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crew_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document_number" text,
	"issuing_authority" text,
	"endorsement_type_id" uuid,
	"issue_date" date,
	"expiry_date" date,
	"cached_status" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crew_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"category_id" uuid,
	"nationality" text,
	"date_of_birth" date,
	"vessel_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endorsement_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "endorsement_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "crew_certificate_attachments" ADD CONSTRAINT "crew_certificate_attachments_crew_certificate_id_crew_certificates_id_fk" FOREIGN KEY ("crew_certificate_id") REFERENCES "public"."crew_certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_certificate_attachments" ADD CONSTRAINT "crew_certificate_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_certificates" ADD CONSTRAINT "crew_certificates_crew_member_id_crew_members_id_fk" FOREIGN KEY ("crew_member_id") REFERENCES "public"."crew_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_certificates" ADD CONSTRAINT "crew_certificates_endorsement_type_id_endorsement_types_id_fk" FOREIGN KEY ("endorsement_type_id") REFERENCES "public"."endorsement_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_category_id_crew_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."crew_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crew_certificates_crew_member_id_idx" ON "crew_certificates" USING btree ("crew_member_id");--> statement-breakpoint
CREATE INDEX "crew_certificates_expiry_date_idx" ON "crew_certificates" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "crew_members_vessel_id_idx" ON "crew_members" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "crew_members_status_idx" ON "crew_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crew_members_category_id_idx" ON "crew_members" USING btree ("category_id");