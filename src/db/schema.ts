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
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

// ---------------------------------------------------------------------------
// Certificates module (PROJECT_PLAN.md §1) — five tables
// ---------------------------------------------------------------------------

/**
 * Broad certificate category (not the issuing organization). Fixed 7 values
 * confirmed against both official source docs — Statutory / Lifeboat / VDR
 * items file under flag / safety / radio, not separate authority values.
 */
export const certificateAuthorityEnum = [
  "flag",
  "class",
  "safety",
  "radio",
  "insurance",
  "management",
  "other",
] as const;
/** Union of {@link certificateAuthorityEnum} literals. */
export type CertificateAuthority = (typeof certificateAuthorityEnum)[number];

/** Per-type reminder rule kind consumed by `src/lib/expiry`. */
export const reminderRuleKindEnum = ["none", "expiry_offset", "window"] as const;
/** Union of {@link reminderRuleKindEnum} literals. */
export type ReminderRuleKind = (typeof reminderRuleKindEnum)[number];

/** Certificate lifecycle — non-`active` forces engine status `revoked`. */
export const certificateLifecycleEnum = [
  "active",
  "revoked",
  "superseded",
] as const;
/** Union of {@link certificateLifecycleEnum} literals. */
export type CertificateLifecycle = (typeof certificateLifecycleEnum)[number];

/** History-log event kinds on a certificate. */
export const certificateEventTypeEnum = [
  "issued",
  "extended",
  "renewed",
  "revoked",
] as const;
/** Union of {@link certificateEventTypeEnum} literals. */
export type CertificateEventType = (typeof certificateEventTypeEnum)[number];

/**
 * Seeded, user-extensible issuing organizations (e.g. "NIPPON KAIJI KYOKAI").
 * Distinct from {@link certificateAuthorityEnum} (the broad category).
 * `ON DELETE RESTRICT` on certificates.issuingAuthorityId — cross-entity
 * reference data (§0.9).
 */
export const issuingAuthorities = pgTable("issuing_authorities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link issuingAuthorities}. */
export type IssuingAuthorityRow = typeof issuingAuthorities.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link issuingAuthorities}. */
export type IssuingAuthorityInsert = typeof issuingAuthorities.$inferInsert;

/**
 * Seeded certificate type catalog — one row per validity variant (e.g.
 * "SMC — Intermediate" vs "SMC — Renewal/Full Term"), each with its own
 * reminder rule. Unique on `(authority, name)`.
 */
export const certificateTypes = pgTable(
  "certificate_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authority: text("authority", { enum: certificateAuthorityEnum }).notNull(),
    name: text("name").notNull(),
    ruleKind: text("rule_kind", { enum: reminderRuleKindEnum })
      .notNull()
      .default("expiry_offset"),
    offsetDays: integer("offset_days"),
    isCustom: boolean("is_custom").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("certificate_types_authority_name_uidx").on(t.authority, t.name)],
);

/** A row as read from {@link certificateTypes}. */
export type CertificateTypeRow = typeof certificateTypes.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link certificateTypes}. */
export type CertificateTypeInsert = typeof certificateTypes.$inferInsert;

/**
 * Vessel compliance certificate instance. Soft-lifecycle via
 * `lifecycleStatus` — hard delete is reserved for true mistakes.
 * FKs to vessels / types / issuing authorities are `ON DELETE RESTRICT`.
 */
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "restrict" }),
    certificateTypeId: uuid("certificate_type_id")
      .notNull()
      .references(() => certificateTypes.id, { onDelete: "restrict" }),
    certificateNumber: text("certificate_number"),
    issuingAuthorityId: uuid("issuing_authority_id").references(
      () => issuingAuthorities.id,
      { onDelete: "restrict" },
    ),
    issueDate: date("issue_date"),
    expiryDate: date("expiry_date"),
    windowOpenDate: date("window_open_date"),
    windowCloseDate: date("window_close_date"),
    linkedToDryDock: boolean("linked_to_dry_dock").notNull().default(false),
    customOffsetDays: integer("custom_offset_days"),
    lifecycleStatus: text("lifecycle_status", {
      enum: certificateLifecycleEnum,
    })
      .notNull()
      .default("active"),
    /** Non-authoritative cache — every meaningful read recomputes via the engine. */
    cachedStatus: text("cached_status"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("certificates_vessel_id_idx").on(t.vesselId),
    index("certificates_expiry_date_idx").on(t.expiryDate),
    index("certificates_certificate_type_id_idx").on(t.certificateTypeId),
    index("certificates_lifecycle_status_idx").on(t.lifecycleStatus),
  ],
);

/** A row as read from {@link certificates}. */
export type CertificateRow = typeof certificates.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link certificates}. */
export type CertificateInsert = typeof certificates.$inferInsert;

/**
 * In-place extension / renewal / revocation history. Owned child —
 * `ON DELETE CASCADE` with the parent certificate (§0.9).
 */
export const certificateEvents = pgTable("certificate_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  certificateId: uuid("certificate_id")
    .notNull()
    .references(() => certificates.id, { onDelete: "cascade" }),
  eventType: text("event_type", { enum: certificateEventTypeEnum }).notNull(),
  eventDate: date("event_date").notNull(),
  newExpiryDate: date("new_expiry_date"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link certificateEvents}. */
export type CertificateEventRow = typeof certificateEvents.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link certificateEvents}. */
export type CertificateEventInsert = typeof certificateEvents.$inferInsert;

/**
 * Files attached to a certificate. On-disk path under `data/attachments/`
 * uses a generated name (never user-supplied). Served only via the
 * authenticated `/api/attachments/[id]` route (`SECURITY_PLAN.md` §6).
 * Owned child — `ON DELETE CASCADE`. `uploadedBy` SET NULL on user delete.
 */
export const certificateAttachments = pgTable("certificate_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  certificateId: uuid("certificate_id")
    .notNull()
    .references(() => certificates.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link certificateAttachments}. */
export type CertificateAttachmentRow = typeof certificateAttachments.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link certificateAttachments}. */
export type CertificateAttachmentInsert =
  typeof certificateAttachments.$inferInsert;
