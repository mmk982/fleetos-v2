/**
 * Central Drizzle schema — every table in the app is declared here, in one
 * file, per the convention in `PROJECT_PLAN.md` ("Conventions this plan
 * follows"). New modules add their tables to this file; they do not create
 * per-module schema files.
 *
 * PostgreSQL (`pgTable`, native `uuid` / `date` / `timestamptz` / `boolean`)
 * via `drizzle-orm/node-postgres`. Migrated from SQLite in
 * `MASTER_IMPLEMENTATION_PLAN.md` Phase 2 — do not reintroduce `sqliteTable`.
 */
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Lifecycle state of a vessel record. `archived` is a soft-retire, not a delete. */
export const vesselStatusEnum = ["active", "inactive", "archived"] as const;
/** Union of the literal values in {@link vesselStatusEnum} — the type-level counterpart used wherever a vessel status is passed around outside the raw enum array itself. */
export type VesselStatus = (typeof vesselStatusEnum)[number];

/**
 * Fleet units. The reference schema/module for every later module — see
 * `PROJECT_PLAN.md`'s "Conventions" section, which was extracted from this
 * exact table and its surrounding files.
 */
export const vessels = pgTable("vessels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // Unique fleet-wide (not just per-vessel): a real IMO number is a globally
  // unique 7-digit vessel identifier by IMO convention, so uniqueness here
  // mirrors the real-world constraint, not an arbitrary app rule.
  imoNumber: integer("imo_number").unique(),
  mmsi: text("mmsi"),
  callSign: text("call_sign"),
  flagState: text("flag_state"),
  vesselType: text("vessel_type"),
  grossTonnage: integer("gross_tonnage"),
  yearBuilt: integer("year_built"),
  status: text("status", { enum: vesselStatusEnum }).notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A row as read from the database. */
export type VesselRow = typeof vessels.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` — includes optional/defaulted columns. */
export type VesselInsert = typeof vessels.$inferInsert;
