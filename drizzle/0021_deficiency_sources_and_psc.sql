-- Phase 0: deficiency_sources system list + backfill source_id
-- Phase 1: psc_inspections + nullable psc_inspection_id on deficiencies
CREATE TABLE "deficiency_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deficiency_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "deficiency_sources" ("name", "is_custom") VALUES
	('psc', false),
	('class', false),
	('flag', false),
	('internal', false),
	('other', false);
--> statement-breakpoint
CREATE TABLE "psc_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid NOT NULL,
	"port" text NOT NULL,
	"inspection_date" date NOT NULL,
	"authority" text NOT NULL,
	"result" text NOT NULL,
	"detained" boolean DEFAULT false NOT NULL,
	"inspector_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psc_inspections" ADD CONSTRAINT "psc_inspections_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deficiencies" ADD COLUMN "source_id" uuid;
--> statement-breakpoint
UPDATE "deficiencies" AS d SET "source_id" = s."id"
FROM "deficiency_sources" AS s
WHERE s."name" = d."source";
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "deficiencies" WHERE "source_id" IS NULL) THEN
		RAISE EXCEPTION 'deficiency source_id backfill left NULL rows — aborting before DROP COLUMN source';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "deficiencies" ALTER COLUMN "source_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "deficiencies" ADD CONSTRAINT "deficiencies_source_id_deficiency_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."deficiency_sources"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deficiencies" DROP COLUMN "source";
--> statement-breakpoint
ALTER TABLE "deficiencies" ADD COLUMN "psc_inspection_id" uuid;
--> statement-breakpoint
ALTER TABLE "deficiencies" ADD CONSTRAINT "deficiencies_psc_inspection_id_psc_inspections_id_fk" FOREIGN KEY ("psc_inspection_id") REFERENCES "public"."psc_inspections"("id") ON DELETE set null ON UPDATE no action;
