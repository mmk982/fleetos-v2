CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vessel_id" uuid,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"related_item_kind" text,
	"related_item_id" uuid,
	"priority" text DEFAULT 'medium' NOT NULL,
	"reminder_date" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "public"."vessels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminders_vessel_id_idx" ON "reminders" USING btree ("vessel_id");--> statement-breakpoint
CREATE INDEX "reminders_status_idx" ON "reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reminders_reminder_date_idx" ON "reminders" USING btree ("reminder_date");--> statement-breakpoint
CREATE INDEX "reminders_type_idx" ON "reminders" USING btree ("type");