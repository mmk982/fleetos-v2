ALTER TABLE "notifications" ADD COLUMN "cycle_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Collapse duplicates created by concurrent sweeps before enforcing uniqueness (keeps the oldest).
DELETE FROM "notifications" n USING "notifications" d WHERE n."user_id" = d."user_id" AND n."record_id" = d."record_id" AND n."notification_type" = d."notification_type" AND n."cycle_key" = d."cycle_key" AND (n."created_at", n."id") > (d."created_at", d."id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_record_type_cycle_uq" ON "notifications" USING btree ("user_id","record_id","notification_type","cycle_key");
