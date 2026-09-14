CREATE TABLE "deficiency_severity_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deficiency_severity_levels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "deficiencies" ADD COLUMN "severity_level_id" uuid;--> statement-breakpoint
ALTER TABLE "deficiencies" ADD CONSTRAINT "deficiencies_severity_level_id_deficiency_severity_levels_id_fk" FOREIGN KEY ("severity_level_id") REFERENCES "public"."deficiency_severity_levels"("id") ON DELETE restrict ON UPDATE no action;