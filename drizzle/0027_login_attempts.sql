CREATE TABLE "login_attempts" (
	"scope" text NOT NULL,
	"key_hash" text NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"last_failure_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "login_attempts_scope_key_hash_pk" PRIMARY KEY("scope","key_hash"),
	CONSTRAINT "login_attempts_scope_chk" CHECK ("login_attempts"."scope" IN ('account','ip'))
);
--> statement-breakpoint
CREATE INDEX "login_attempts_window_started_at_idx" ON "login_attempts" USING btree ("window_started_at");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON login_attempts TO fleetos_app;
