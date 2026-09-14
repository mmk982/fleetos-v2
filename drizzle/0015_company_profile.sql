CREATE TABLE "company_profile" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"company_name" text,
	"registration_number" text,
	"address" text,
	"contact_email" text,
	"contact_phone" text,
	"timezone" text,
	"date_format" text,
	"logo_path" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_profile_singleton_chk" CHECK ("company_profile"."id" = 1)
);
