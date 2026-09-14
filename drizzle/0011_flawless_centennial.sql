CREATE TABLE "vessel_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_particulars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"class_society" text,
	"port_of_registry" text,
	"owner" text,
	"manager" text,
	"deadweight_tonnage" integer,
	"net_registered_tonnage" integer,
	"length_overall" numeric,
	"breadth" numeric,
	"depth" numeric,
	"draft" numeric,
	"main_engine" text,
	"aux_engines" text,
	"cargo_capacity" numeric,
	"ballast_capacity" numeric,
	"fuel_oil_capacity" numeric,
	"fresh_water_capacity" numeric,
	"is_current" boolean DEFAULT true NOT NULL,
	"effective_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_particulars_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"particulars_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vessel_notes" ADD CONSTRAINT "vessel_notes_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_notes" ADD CONSTRAINT "vessel_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_particulars" ADD CONSTRAINT "vessel_particulars_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_particulars_attachments" ADD CONSTRAINT "vessel_particulars_attachments_particulars_id_vessel_particulars_id_fk" FOREIGN KEY ("particulars_id") REFERENCES "public"."vessel_particulars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_particulars_attachments" ADD CONSTRAINT "vessel_particulars_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vessel_notes_vessel_id_idx" ON "vessel_notes" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "vessel_particulars_vessel_id_idx" ON "vessel_particulars" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "vessel_particulars_is_current_idx" ON "vessel_particulars" USING btree ("is_current");