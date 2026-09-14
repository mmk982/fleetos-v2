-- Normalize placeholder / invalid roles before NOT NULL + enum vocabulary.
UPDATE "users"
SET "role" = 'admin'
WHERE "role" IS NULL
   OR "role" NOT IN (
     'admin',
     'management_user',
     'superintendent',
     'vessel_user',
     'read_only'
   );--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "vessel_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN (
  'admin',
  'management_user',
  'superintendent',
  'vessel_user',
  'read_only'
));
