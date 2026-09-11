CREATE TABLE "certificate_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_date" date NOT NULL,
	"new_expiry_date" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authority" text NOT NULL,
	"name" text NOT NULL,
	"rule_kind" text DEFAULT 'expiry_offset' NOT NULL,
	"offset_days" integer,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"certificate_type_id" uuid NOT NULL,
	"certificate_number" text,
	"issuing_authority_id" uuid,
	"issue_date" date,
	"expiry_date" date,
	"window_open_date" date,
	"window_close_date" date,
	"linked_to_dry_dock" boolean DEFAULT false NOT NULL,
	"custom_offset_days" integer,
	"lifecycle_status" text DEFAULT 'active' NOT NULL,
	"cached_status" text,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issuing_authorities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issuing_authorities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "certificate_attachments" ADD CONSTRAINT "certificate_attachments_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_attachments" ADD CONSTRAINT "certificate_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_events" ADD CONSTRAINT "certificate_events_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_certificate_type_id_certificate_types_id_fk" FOREIGN KEY ("certificate_type_id") REFERENCES "public"."certificate_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issuing_authority_id_issuing_authorities_id_fk" FOREIGN KEY ("issuing_authority_id") REFERENCES "public"."issuing_authorities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_types_authority_name_uidx" ON "certificate_types" USING btree ("authority","name");--> statement-breakpoint
CREATE INDEX "certificates_vessel_id_idx" ON "certificates" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "certificates_expiry_date_idx" ON "certificates" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "certificates_certificate_type_id_idx" ON "certificates" USING btree ("certificate_type_id");--> statement-breakpoint
CREATE INDEX "certificates_lifecycle_status_idx" ON "certificates" USING btree ("lifecycle_status");