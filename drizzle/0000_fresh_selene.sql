CREATE TABLE "vessels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"imo_number" integer,
	"mmsi" text,
	"call_sign" text,
	"flag_state" text,
	"vessel_type" text,
	"gross_tonnage" integer,
	"year_built" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vessels_imo_number_unique" UNIQUE("imo_number")
);
