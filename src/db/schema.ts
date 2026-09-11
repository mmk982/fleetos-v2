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
 * UI locale preference stored on the user row (`PROJECT_PLAN.md` §14a).
 * Cookie-driven fallback applies before login; this column wins once signed in.
 */
export const userLocaleEnum = ["en", "ar"] as const;
/** Union of {@link userLocaleEnum} literals. */
export type UserLocale = (typeof userLocaleEnum)[number];

/**
 * UI theme preference stored on the user row (`PROJECT_PLAN.md` §14b).
 * Independent of locale — any locale×theme combination is valid.
 */
export const userThemeEnum = ["light", "dark"] as const;
/** Union of {@link userThemeEnum} literals. */
export type UserTheme = (typeof userThemeEnum)[number];

/**
 * Signed-in accounts. Built in Phase 3 ahead of every feature module so
 * `uploadedBy` / `authorId` / `notifications.userId` FKs are real `users.id`
 * references from their first migration (`MASTER_IMPLEMENTATION_PLAN.md`
 * Phase 3). `role` is a nullable placeholder until Phase 6 RBAC enforces it.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Phase 6 fills this in and enforces it; until then it is stored but unused.
  role: text("role"),
  preferredLocale: text("preferred_locale", { enum: userLocaleEnum }),
  preferredTheme: text("preferred_theme", { enum: userThemeEnum }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A user row as read from the database. */
export type UserRow = typeof users.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link users}. */
export type UserInsert = typeof users.$inferInsert;

/**
 * Server-side session rows backing the httpOnly signed session cookie
 * (`SECURITY_PLAN.md` §3 / `src/lib/auth/session.ts`).
 *
 * `userId` uses `ON DELETE CASCADE` deliberately — deleting a user must
 * invalidate every session for that account. That is *not* the
 * log-userId `SET NULL` pattern used on activity/access logs.
 */
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A session row as read from the database. */
export type SessionRow = typeof sessions.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link sessions}. */
export type SessionInsert = typeof sessions.$inferInsert;

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
