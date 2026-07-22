CREATE TABLE `vessels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`imo_number` integer,
	`mmsi` text,
	`call_sign` text,
	`flag_state` text,
	`vessel_type` text,
	`gross_tonnage` integer,
	`year_built` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
