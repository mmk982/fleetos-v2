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
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
 * Phase 6 RBAC roles (`MASTER_IMPLEMENTATION_PLAN.md` Phase 6).
 * Binary allow/deny per module — no “limited” tier.
 */
export const userRoleEnum = [
  "admin",
  "management_user",
  "superintendent",
  "vessel_user",
  "read_only",
] as const;
/** Union of {@link userRoleEnum} literals. */
export type UserRole = (typeof userRoleEnum)[number];

/**
 * Signed-in accounts. Built in Phase 3 ahead of every feature module so
 * `uploadedBy` / `authorId` / `notifications.userId` FKs are real `users.id`
 * references from their first migration (`MASTER_IMPLEMENTATION_PLAN.md`
 * Phase 3). Role enum + vessel scoping columns land with Phase 6 groundwork
 * (`PROJECT_PLAN.md` §7a); module-wide permission enforcement remains deferred.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: userRoleEnum }).notNull().default("admin"),
  /**
   * Set only for `management_user` / `vessel_user` — office roles stay null.
   * App-layer enforcement deferred; FK only in this pass.
   */
  vesselId: uuid("vessel_id").references(() => vessels.id, {
    onDelete: "restrict",
  }),
  /** Deactivated users cannot log in; live sessions fail `validateSession`. */
  isActive: boolean("is_active").notNull().default(true),
  /** Updated on successful login for Users & Roles “Last login”. */
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
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
 * Generic key-value app settings (`PROJECT_PLAN.md` §7a).
 * Typed accessors (e.g. `getCriticalDays`) cast/validate `value` — the
 * column stays text so new settings do not need schema migrations.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A settings row as read from the database. */
export type SettingRow = typeof settings.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link settings}. */
export type SettingInsert = typeof settings.$inferInsert;

/**
 * Single-row company identity (`PROJECT_PLAN.md` §7a Company Profile).
 * Always `id = 1` — not a key-value setting because the shape is fixed.
 */
export const companyProfile = pgTable(
  "company_profile",
  {
    id: smallint("id").primaryKey().default(1),
    companyName: text("company_name"),
    registrationNumber: text("registration_number"),
    address: text("address"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    timezone: text("timezone"),
    dateFormat: text("date_format"),
    /** Relative path under `data/attachments/` (same convention as module uploads). */
    logoPath: text("logo_path"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("company_profile_singleton_chk", sql`${t.id} = 1`)],
);

/** A company profile row as read from the database. */
export type CompanyProfileRow = typeof companyProfile.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link companyProfile}. */
export type CompanyProfileInsert = typeof companyProfile.$inferInsert;

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

// ---------------------------------------------------------------------------
// Deficiencies module (PROJECT_PLAN.md §2) — two tables
// ---------------------------------------------------------------------------

/**
 * Where a deficiency was raised. Fixed set from the requirements doc —
 * not user-extensible (unlike certificate_types).
 */
export const deficiencySourceEnum = [
  "psc",
  "class",
  "flag",
  "internal",
  "other",
] as const;
/** Union of {@link deficiencySourceEnum} literals. */
export type DeficiencySource = (typeof deficiencySourceEnum)[number];

/**
 * Stored lifecycle status for a deficiency — authoritative for the module
 * (unlike certificate compliance, which is date-derived). Non-`closed`
 * rows with a `dueDate` feed the alerts aggregator (§0.7).
 */
export const deficiencyStatusEnum = [
  "open",
  "in_progress",
  "closed",
  "monitoring",
] as const;
/** Union of {@link deficiencyStatusEnum} literals. */
export type DeficiencyStatus = (typeof deficiencyStatusEnum)[number];

/**
 * Vessel findings / non-conformities. `status` is a real stored column,
 * not an engine cache. Vessel FK is `ON DELETE RESTRICT`.
 * `severityLevelId` is additive/nullable — Settings System Lists CRUD only
 * in this pass; Deficiencies form wiring is deferred.
 */
export const deficiencySeverityLevels = pgTable("deficiency_severity_levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link deficiencySeverityLevels}. */
export type DeficiencySeverityLevelRow =
  typeof deficiencySeverityLevels.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link deficiencySeverityLevels}. */
export type DeficiencySeverityLevelInsert =
  typeof deficiencySeverityLevels.$inferInsert;

/**
 * Where a deficiency was raised (PSC, Class, Flag, …). Seeded well-known
 * names match {@link deficiencySourceEnum}; users may add custom rows.
 */
export const deficiencySources = pgTable("deficiency_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link deficiencySources}. */
export type DeficiencySourceRow = typeof deficiencySources.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link deficiencySources}. */
export type DeficiencySourceInsert = typeof deficiencySources.$inferInsert;

/**
 * PSC / MOU inspection records (`PROJECT_PLAN.md` §7b).
 * `result` and `detained` are separate: detention is an escalation on top of
 * a deficiencies-noted inspection, not a third mutually-exclusive outcome.
 */
export const pscInspectionResultEnum = [
  "no_deficiencies",
  "deficiencies_noted",
] as const;
/** Union of {@link pscInspectionResultEnum} literals. */
export type PscInspectionResult = (typeof pscInspectionResultEnum)[number];

export const pscInspections = pgTable("psc_inspections", {
  id: uuid("id").defaultRandom().primaryKey(),
  vesselId: uuid("vessel_id")
    .notNull()
    .references(() => vessels.id, { onDelete: "restrict" }),
  port: text("port").notNull(),
  inspectionDate: date("inspection_date").notNull(),
  authority: text("authority").notNull(),
  result: text("result", { enum: pscInspectionResultEnum }).notNull(),
  detained: boolean("detained").notNull().default(false),
  inspectorName: text("inspector_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link pscInspections}. */
export type PscInspectionRow = typeof pscInspections.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link pscInspections}. */
export type PscInspectionInsert = typeof pscInspections.$inferInsert;

/**
 * ISSC / MLC / SMC / DOC audit event log. Standalone — no FK to deficiencies
 * (unlike PSC inspections, which may link findings). Pass/fail events with an
 * optional note; no expiry / compliance-status concept.
 */
export const auditTypeEnum = ["ISSC", "MLC", "SMC", "DOC", "Other"] as const;
/** Union of {@link auditTypeEnum} literals. */
export type AuditType = (typeof auditTypeEnum)[number];

export const audits = pgTable("audits", {
  id: uuid("id").defaultRandom().primaryKey(),
  vesselId: uuid("vessel_id")
    .notNull()
    .references(() => vessels.id, { onDelete: "restrict" }),
  auditType: text("audit_type", { enum: auditTypeEnum }).notNull(),
  auditDate: date("audit_date").notNull(),
  auditor: text("auditor"),
  findingsCount: integer("findings_count").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link audits}. */
export type AuditRow = typeof audits.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link audits}. */
export type AuditInsert = typeof audits.$inferInsert;

export const deficiencies = pgTable(
  "deficiencies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "restrict" }),
    deficiencyNumber: text("deficiency_number"),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => deficiencySources.id, { onDelete: "restrict" }),
    status: text("status", { enum: deficiencyStatusEnum })
      .notNull()
      .default("open"),
    severityLevelId: uuid("severity_level_id").references(
      () => deficiencySeverityLevels.id,
      { onDelete: "restrict" },
    ),
    pscInspectionId: uuid("psc_inspection_id").references(
      () => pscInspections.id,
      { onDelete: "set null" },
    ),
    reference: text("reference"),
    identifiedDate: date("identified_date"),
    dueDate: date("due_date"),
    closedDate: date("closed_date"),
    correctiveAction: text("corrective_action"),
    responsiblePerson: text("responsible_person"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("deficiencies_vessel_id_idx").on(t.vesselId),
    index("deficiencies_status_idx").on(t.status),
    index("deficiencies_due_date_idx").on(t.dueDate),
  ],
);

/** A row as read from {@link deficiencies}. */
export type DeficiencyRow = typeof deficiencies.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link deficiencies}. */
export type DeficiencyInsert = typeof deficiencies.$inferInsert;

/**
 * Files attached to a deficiency. Same on-disk / serve conventions as
 * {@link certificateAttachments}. `uploadedBy` is `users.id` (SET NULL) —
 * §2 originally said free-text pending Phase 3; Auth already shipped, so
 * we match Certificates rather than regress to free text.
 */
export const deficiencyAttachments = pgTable("deficiency_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  deficiencyId: uuid("deficiency_id")
    .notNull()
    .references(() => deficiencies.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link deficiencyAttachments}. */
export type DeficiencyAttachmentRow = typeof deficiencyAttachments.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link deficiencyAttachments}. */
export type DeficiencyAttachmentInsert =
  typeof deficiencyAttachments.$inferInsert;

// ---------------------------------------------------------------------------
// Crew module (PROJECT_PLAN.md §3) — five tables
// ---------------------------------------------------------------------------

/** Crew member employment lifecycle — stored domain enum, not engine-derived. */
export const crewStatusEnum = ["active", "inactive"] as const;
/** Union of {@link crewStatusEnum} literals. */
export type CrewStatus = (typeof crewStatusEnum)[number];

/**
 * Seeded/extensible crew rank/category (Master, Chief Engineer, …).
 * Replaces free-text `rank` per System Lists Management (§3 / §7a).
 */
export const crewCategories = pgTable("crew_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link crewCategories}. */
export type CrewCategoryRow = typeof crewCategories.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link crewCategories}. */
export type CrewCategoryInsert = typeof crewCategories.$inferInsert;

/**
 * Seeded/extensible STCW (and similar) endorsement categories.
 * Nullable on crew certificates — not every document is endorsement-bearing.
 */
export const endorsementTypes = pgTable("endorsement_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link endorsementTypes}. */
export type EndorsementTypeRow = typeof endorsementTypes.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link endorsementTypes}. */
export type EndorsementTypeInsert = typeof endorsementTypes.$inferInsert;

/**
 * Crew member with optional current vessel assignment.
 * Holds GDPR-scope PII (names, nationality, DOB) — see `scrubCrewMemberPii`
 * and `access_logs` (PROJECT_PLAN.md §6 / Phase 4).
 */
export const crewMembers = pgTable(
  "crew_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    categoryId: uuid("category_id").references(() => crewCategories.id, {
      onDelete: "restrict",
    }),
    nationality: text("nationality"),
    dateOfBirth: date("date_of_birth"),
    vesselId: uuid("vessel_id").references(() => vessels.id, {
      onDelete: "restrict",
    }),
    status: text("status", { enum: crewStatusEnum })
      .notNull()
      .default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("crew_members_vessel_id_idx").on(t.vesselId),
    index("crew_members_status_idx").on(t.status),
    index("crew_members_category_id_idx").on(t.categoryId),
  ],
);

/** A row as read from {@link crewMembers}. */
export type CrewMemberRow = typeof crewMembers.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link crewMembers}. */
export type CrewMemberInsert = typeof crewMembers.$inferInsert;

/**
 * Personal / professional documents on a crew member (passport, STCW, ENG1).
 * Expiry uses the shared engine with a fixed 30d offset rule (§3).
 * Document numbers/dates are PII — in scope for `scrubCrewMemberPii`.
 */
export const crewCertificates = pgTable(
  "crew_certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    crewMemberId: uuid("crew_member_id")
      .notNull()
      .references(() => crewMembers.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    documentNumber: text("document_number"),
    issuingAuthority: text("issuing_authority"),
    endorsementTypeId: uuid("endorsement_type_id").references(
      () => endorsementTypes.id,
      { onDelete: "restrict" },
    ),
    issueDate: date("issue_date"),
    expiryDate: date("expiry_date"),
    cachedStatus: text("cached_status"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("crew_certificates_crew_member_id_idx").on(t.crewMemberId),
    index("crew_certificates_expiry_date_idx").on(t.expiryDate),
  ],
);

/** A row as read from {@link crewCertificates}. */
export type CrewCertificateRow = typeof crewCertificates.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link crewCertificates}. */
export type CrewCertificateInsert = typeof crewCertificates.$inferInsert;

/**
 * Scans for a crew certificate (passport photo page, visa, etc.).
 * Same on-disk / serve conventions as other `*_attachments` tables.
 * Scrub-PII must remove these files, not only parent text fields.
 */
export const crewCertificateAttachments = pgTable(
  "crew_certificate_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    crewCertificateId: uuid("crew_certificate_id")
      .notNull()
      .references(() => crewCertificates.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/** A row as read from {@link crewCertificateAttachments}. */
export type CrewCertificateAttachmentRow =
  typeof crewCertificateAttachments.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link crewCertificateAttachments}. */
export type CrewCertificateAttachmentInsert =
  typeof crewCertificateAttachments.$inferInsert;

// ---------------------------------------------------------------------------
// GDPR access log (PROJECT_PLAN.md §6) — Crew personal-data reads only
// ---------------------------------------------------------------------------

/**
 * Access kinds logged against Crew PII. Not a general page-view log —
 * list pages that show only names/status do not write here.
 */
export const accessLogTypeEnum = [
  "view",
  "download_attachment",
  "export",
] as const;
/** Union of {@link accessLogTypeEnum} literals. */
export type AccessLogType = (typeof accessLogTypeEnum)[number];

/**
 * Append-only log of who accessed Crew personal data (`MASTER_PLAN.md`
 * Phase 4 / `PROJECT_PLAN.md` §6). Scoped to `crew_members` /
 * `crew_certificates` / `crew_certificate_attachments` only.
 */
export const accessLogs = pgTable("access_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  moduleName: text("module_name").notNull(),
  recordId: uuid("record_id").notNull(),
  accessType: text("access_type", { enum: accessLogTypeEnum }).notNull(),
  accessedAt: timestamp("accessed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link accessLogs}. */
export type AccessLogRow = typeof accessLogs.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link accessLogs}. */
export type AccessLogInsert = typeof accessLogs.$inferInsert;

/**
 * Append-only operational activity trail for Dashboard “Recent activity”
 * (`PROJECT_PLAN.md` §5 / §6). `recordId` is polymorphic by `moduleName` —
 * not a typed FK. `userId` uses SET NULL (log-userId category, §0.9).
 */
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  actionType: text("action_type").notNull(),
  moduleName: text("module_name").notNull(),
  recordId: uuid("record_id").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link activityLogs}. */
export type ActivityLogRow = typeof activityLogs.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link activityLogs}. */
export type ActivityLogInsert = typeof activityLogs.$inferInsert;

// ---------------------------------------------------------------------------
// Notifications module (PROJECT_PLAN.md §12a)
// ---------------------------------------------------------------------------

/**
 * Persisted notification kinds for the top-bar bell.
 * `crew_certificate_due` is an intentional addition so crew-cert alerts can
 * map cleanly; `missing_form` / `upload` stay reserved for later generators.
 */
export const notificationTypeEnum = [
  "certificate_due",
  "certificate_expired",
  "crew_certificate_due",
  "insurance_due",
  "missing_form",
  "upload",
  "deficiency_update",
  "reminder",
] as const;
/** Union of {@link notificationTypeEnum} literals. */
export type NotificationType = (typeof notificationTypeEnum)[number];

/**
 * Per-user notification inbox. Generated by a lazy `syncNotifications`
 * sweep (deduped on `userId` + `recordId` + `notificationType`).
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    vesselId: uuid("vessel_id").references(() => vessels.id, {
      onDelete: "restrict",
    }),
    /** Polymorphic source row id (alert item / reminder); used for dedup. */
    recordId: uuid("record_id"),
    title: text("title").notNull(),
    message: text("message"),
    notificationType: text("notification_type", {
      enum: notificationTypeEnum,
    }).notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_user_id_idx").on(t.userId),
    index("notifications_user_read_idx").on(t.userId, t.isRead),
    index("notifications_created_at_idx").on(t.createdAt),
  ],
);

/** A row as read from {@link notifications}. */
export type NotificationRow = typeof notifications.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link notifications}. */
export type NotificationInsert = typeof notifications.$inferInsert;

// ---------------------------------------------------------------------------
// Email digest (PROJECT_PLAN.md §12b)
// ---------------------------------------------------------------------------

/**
 * One row per Admin per calendar day that a digest was successfully sent.
 * Dedupes cron retries via unique (recipientUserId, digestDate).
 */
export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    digestDate: date("digest_date").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("email_deliveries_recipient_date_uidx").on(
      t.recipientUserId,
      t.digestDate,
    ),
  ],
);

/** A row as read from {@link emailDeliveries}. */
export type EmailDeliveryRow = typeof emailDeliveries.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link emailDeliveries}. */
export type EmailDeliveryInsert = typeof emailDeliveries.$inferInsert;

// ---------------------------------------------------------------------------
// Insurance module (PROJECT_PLAN.md §4)
// ---------------------------------------------------------------------------

/**
 * Policy type vocabulary — plain TS const (same style as deficiencyStatusEnum),
 * not a Postgres enum. `"other"` is the catch-all for types outside the four
 * archive-grounded values (Revision note 7).
 */
export const insuranceTypeEnum = [
  "pi",
  "hm",
  "war_risk",
  "fdd",
  "other",
] as const;
/** Union of {@link insuranceTypeEnum} literals. */
export type InsuranceType = (typeof insuranceTypeEnum)[number];

/**
 * Vessel insurance policy. Expiry uses the shared engine with a fixed 30d
 * offset rule (§4) — `cachedStatus` is a non-authoritative write-side cache.
 */
export const insurancePolicies = pgTable(
  "insurance_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "restrict" }),
    policyType: text("policy_type", { enum: insuranceTypeEnum }).notNull(),
    provider: text("provider"),
    policyNumber: text("policy_number"),
    coverageAmount: integer("coverage_amount"),
    currency: text("currency"),
    startDate: date("start_date"),
    expiryDate: date("expiry_date"),
    cachedStatus: text("cached_status"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("insurance_policies_vessel_id_idx").on(t.vesselId),
    index("insurance_policies_policy_type_idx").on(t.policyType),
    index("insurance_policies_expiry_date_idx").on(t.expiryDate),
  ],
);

/** A row as read from {@link insurancePolicies}. */
export type InsurancePolicyRow = typeof insurancePolicies.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link insurancePolicies}. */
export type InsurancePolicyInsert = typeof insurancePolicies.$inferInsert;

/**
 * Files attached to an insurance policy. Same on-disk / serve conventions as
 * other `*_attachments` tables. Out of GDPR `access_logs` scope (§6b).
 */
export const insuranceAttachments = pgTable("insurance_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  insurancePolicyId: uuid("insurance_policy_id")
    .notNull()
    .references(() => insurancePolicies.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link insuranceAttachments}. */
export type InsuranceAttachmentRow = typeof insuranceAttachments.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link insuranceAttachments}. */
export type InsuranceAttachmentInsert =
  typeof insuranceAttachments.$inferInsert;

// ---------------------------------------------------------------------------
// ISM Templates module (PROJECT_PLAN.md §9) — fleet-wide, not vessel-specific
// ---------------------------------------------------------------------------

/**
 * Template lifecycle — stored domain enum, not engine-derived.
 * Plain TS const (same style as insuranceTypeEnum).
 */
export const ismTemplateStatusEnum = [
  "active",
  "superseded",
  "draft",
] as const;
/** Union of {@link ismTemplateStatusEnum} literals. */
export type IsmTemplateStatus = (typeof ismTemplateStatusEnum)[number];

/**
 * Seeded/extensible ISM form categories (Drill, Maintenance, …).
 * User CRUD deferred to Settings (§7a); this pass is seed + read-only list.
 */
export const ismTemplateCategories = pgTable("ism_template_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link ismTemplateCategories}. */
export type IsmTemplateCategoryRow = typeof ismTemplateCategories.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link ismTemplateCategories}. */
export type IsmTemplateCategoryInsert =
  typeof ismTemplateCategories.$inferInsert;

/**
 * Fleet-wide blank form template (no vesselId — Monthly Executed Forms
 * later bind an execution to a vessel). Not an expiry-engine consumer.
 */
export const ismTemplates = pgTable(
  "ism_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formCode: text("form_code").notNull().unique(),
    formName: text("form_name").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => ismTemplateCategories.id, { onDelete: "restrict" }),
    revision: text("revision"),
    status: text("status", { enum: ismTemplateStatusEnum })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ism_templates_category_id_idx").on(t.categoryId),
    index("ism_templates_status_idx").on(t.status),
  ],
);

/** A row as read from {@link ismTemplates}. */
export type IsmTemplateRow = typeof ismTemplates.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link ismTemplates}. */
export type IsmTemplateInsert = typeof ismTemplates.$inferInsert;

/**
 * Blank-form PDF (etc.) attachments for an ISM template. Same on-disk /
 * serve conventions as other `*_attachments` tables. Out of GDPR scope.
 */
export const ismTemplateAttachments = pgTable("ism_template_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  ismTemplateId: uuid("ism_template_id")
    .notNull()
    .references(() => ismTemplates.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link ismTemplateAttachments}. */
export type IsmTemplateAttachmentRow =
  typeof ismTemplateAttachments.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link ismTemplateAttachments}. */
export type IsmTemplateAttachmentInsert =
  typeof ismTemplateAttachments.$inferInsert;

// ---------------------------------------------------------------------------
// Manuals module (PROJECT_PLAN.md §8) — vessel-linked + revision history
// ---------------------------------------------------------------------------

/**
 * Vessel manual metadata (title/type/department stay stable across uploads).
 * Each file upload is a row in {@link manualRevisions}.
 */
export const manuals = pgTable(
  "manuals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    manualType: text("manual_type"),
    department: text("department"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("manuals_vessel_id_idx").on(t.vesselId),
    index("manuals_department_idx").on(t.department),
  ],
);

/** A row as read from {@link manuals}. */
export type ManualRow = typeof manuals.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link manuals}. */
export type ManualInsert = typeof manuals.$inferInsert;

/**
 * One uploaded version of a manual. Carries both the "event" and the file
 * (unlike Certificates' split events/attachments). `fileName` / `uploadedBy`
 * added for parity with other `*_attachments` tables so revisions serve
 * through the generic `/api/attachments/[id]` resolver.
 *
 * Exactly one row per manual should have `isCurrentVersion = true` —
 * enforced in the controller via transactions, not a DB unique constraint.
 */
export const manualRevisions = pgTable(
  "manual_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    manualId: uuid("manual_id")
      .notNull()
      .references(() => manuals.id, { onDelete: "cascade" }),
    revisionNumber: text("revision_number"),
    revisionDate: date("revision_date"),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    isCurrentVersion: boolean("is_current_version").notNull().default(true),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("manual_revisions_manual_id_idx").on(t.manualId),
    index("manual_revisions_is_current_idx").on(t.isCurrentVersion),
  ],
);

/** A row as read from {@link manualRevisions}. */
export type ManualRevisionRow = typeof manualRevisions.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link manualRevisions}. */
export type ManualRevisionInsert = typeof manualRevisions.$inferInsert;

// ---------------------------------------------------------------------------
// Drawings module (PROJECT_PLAN.md §11) — vessel-scoped technical drawings
// ---------------------------------------------------------------------------

/**
 * Seeded/extensible drawing categories (General Arrangement, …).
 * User CRUD deferred to Settings (§7a); this pass is seed + read-only list.
 */
export const drawingCategories = pgTable("drawing_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link drawingCategories}. */
export type DrawingCategoryRow = typeof drawingCategories.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link drawingCategories}. */
export type DrawingCategoryInsert = typeof drawingCategories.$inferInsert;

/**
 * Vessel technical drawing metadata. `revision` is a display label on the
 * row itself — file history lives in {@link drawingAttachments}.
 * Not an expiry-engine consumer.
 */
export const drawings = pgTable(
  "drawings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => drawingCategories.id, { onDelete: "restrict" }),
    drawingName: text("drawing_name").notNull(),
    drawingNumber: text("drawing_number"),
    revision: text("revision"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("drawings_vessel_id_idx").on(t.vesselId),
    index("drawings_category_id_idx").on(t.categoryId),
  ],
);

/** A row as read from {@link drawings}. */
export type DrawingRow = typeof drawings.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link drawings}. */
export type DrawingInsert = typeof drawings.$inferInsert;

/**
 * File attachments for a drawing. Same on-disk / serve conventions as
 * other `*_attachments` tables. Out of GDPR access-log scope.
 */
export const drawingAttachments = pgTable("drawing_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  drawingId: uuid("drawing_id")
    .notNull()
    .references(() => drawings.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row as read from {@link drawingAttachments}. */
export type DrawingAttachmentRow = typeof drawingAttachments.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link drawingAttachments}. */
export type DrawingAttachmentInsert = typeof drawingAttachments.$inferInsert;

// ---------------------------------------------------------------------------
// Monthly Executed Forms (PROJECT_PLAN.md §10)
// ---------------------------------------------------------------------------

/** How often a vessel/template requirement is due. */
export const monthlyFormFrequencyEnum = [
  "monthly",
  "quarterly",
  "yearly",
  "on_demand",
] as const;
/** Union of {@link monthlyFormFrequencyEnum} literals. */
export type MonthlyFormFrequency = (typeof monthlyFormFrequencyEnum)[number];

/**
 * Stored execution status only. `"overdue"` is never persisted — derive it
 * at read time via `deriveMonthlyFormDisplayStatus`.
 */
export const monthlyFormStatusEnum = ["submitted", "pending"] as const;
/** Union of {@link monthlyFormStatusEnum} literals. */
export type MonthlyFormStatus = (typeof monthlyFormStatusEnum)[number];

/**
 * Per-vessel / per-template requirement (independent of any month).
 * Checklist generation reads `activeStatus = true` rows.
 */
export const monthlyFormRequirements = pgTable(
  "monthly_form_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "restrict" }),
    ismTemplateId: uuid("ism_template_id")
      .notNull()
      .references(() => ismTemplates.id, { onDelete: "restrict" }),
    frequency: text("frequency", { enum: monthlyFormFrequencyEnum })
      .notNull()
      .default("monthly"),
    activeStatus: boolean("active_status").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("monthly_form_requirements_vessel_template_uidx").on(
      t.vesselId,
      t.ismTemplateId,
    ),
    index("monthly_form_requirements_vessel_id_idx").on(t.vesselId),
  ],
);

/** A row as read from {@link monthlyFormRequirements}. */
export type MonthlyFormRequirementRow =
  typeof monthlyFormRequirements.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link monthlyFormRequirements}. */
export type MonthlyFormRequirementInsert =
  typeof monthlyFormRequirements.$inferInsert;

/**
 * One vessel/template/period execution row. `formName` is denormalized so
 * history stays readable if the template is renamed. Unique on
 * (vessel, template, month, year).
 */
export const monthlyExecutedForms = pgTable(
  "monthly_executed_forms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "restrict" }),
    ismTemplateId: uuid("ism_template_id").references(() => ismTemplates.id, {
      onDelete: "restrict",
    }),
    formName: text("form_name").notNull(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    required: boolean("required").notNull().default(true),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: monthlyFormStatusEnum })
      .notNull()
      .default("pending"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("monthly_executed_forms_vessel_template_period_uidx").on(
      t.vesselId,
      t.ismTemplateId,
      t.month,
      t.year,
    ),
    index("monthly_executed_forms_vessel_id_idx").on(t.vesselId),
    index("monthly_executed_forms_period_idx").on(t.year, t.month),
    index("monthly_executed_forms_status_idx").on(t.status),
  ],
);

/** A row as read from {@link monthlyExecutedForms}. */
export type MonthlyExecutedFormRow = typeof monthlyExecutedForms.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link monthlyExecutedForms}. */
export type MonthlyExecutedFormInsert =
  typeof monthlyExecutedForms.$inferInsert;

/**
 * Submitted file(s) for an executed form. Out of GDPR access-log scope.
 */
export const monthlyExecutedFormAttachments = pgTable(
  "monthly_executed_form_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    executedFormId: uuid("executed_form_id")
      .notNull()
      .references(() => monthlyExecutedForms.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/** A row as read from {@link monthlyExecutedFormAttachments}. */
export type MonthlyExecutedFormAttachmentRow =
  typeof monthlyExecutedFormAttachments.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link monthlyExecutedFormAttachments}. */
export type MonthlyExecutedFormAttachmentInsert =
  typeof monthlyExecutedFormAttachments.$inferInsert;

// ---------------------------------------------------------------------------
// Ship Particulars + vessel notes (PROJECT_PLAN.md §13)
// ---------------------------------------------------------------------------

/**
 * Historical vessel particulars — exactly one `isCurrent = true` row per
 * vessel at a time (enforced in the controller via transactions).
 */
export const vesselParticulars = pgTable(
  "vessel_particulars",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "restrict" }),
    classSociety: text("class_society"),
    portOfRegistry: text("port_of_registry"),
    owner: text("owner"),
    manager: text("manager"),
    deadweightTonnage: integer("deadweight_tonnage"),
    netRegisteredTonnage: integer("net_registered_tonnage"),
    lengthOverall: numeric("length_overall"),
    breadth: numeric("breadth"),
    depth: numeric("depth"),
    draft: numeric("draft"),
    mainEngine: text("main_engine"),
    auxEngines: text("aux_engines"),
    cargoCapacity: numeric("cargo_capacity"),
    ballastCapacity: numeric("ballast_capacity"),
    fuelOilCapacity: numeric("fuel_oil_capacity"),
    freshWaterCapacity: numeric("fresh_water_capacity"),
    isCurrent: boolean("is_current").notNull().default(true),
    effectiveDate: date("effective_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("vessel_particulars_vessel_id_idx").on(t.vesselId),
    index("vessel_particulars_is_current_idx").on(t.isCurrent),
  ],
);

/** A row as read from {@link vesselParticulars}. */
export type VesselParticularsRow = typeof vesselParticulars.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link vesselParticulars}. */
export type VesselParticularsInsert = typeof vesselParticulars.$inferInsert;

/**
 * Supporting PDFs/images for a particulars record. Out of GDPR scope.
 */
export const vesselParticularsAttachments = pgTable(
  "vessel_particulars_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    particularsId: uuid("particulars_id")
      .notNull()
      .references(() => vesselParticulars.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/** A row as read from {@link vesselParticularsAttachments}. */
export type VesselParticularsAttachmentRow =
  typeof vesselParticularsAttachments.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link vesselParticularsAttachments}. */
export type VesselParticularsAttachmentInsert =
  typeof vesselParticularsAttachments.$inferInsert;

/**
 * Append-only free-text notes per vessel (Vessel Profile Notes tab later).
 * No update path — delete + re-add to correct a mistake.
 */
export const vesselNotes = pgTable(
  "vessel_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vesselId: uuid("vessel_id")
      .notNull()
      .references(() => vessels.id, { onDelete: "restrict" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("vessel_notes_vessel_id_idx").on(t.vesselId)],
);

/** A row as read from {@link vesselNotes}. */
export type VesselNoteRow = typeof vesselNotes.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link vesselNotes}. */
export type VesselNoteInsert = typeof vesselNotes.$inferInsert;

// ---------------------------------------------------------------------------
// Reminders (PROJECT_PLAN.md §12) — user-set, distinct from Alerts
// ---------------------------------------------------------------------------

/** What the reminder is about (loosely mirrors source-doc examples). */
export const reminderTypeEnum = [
  "certificate",
  "insurance",
  "manual",
  "deficiency",
  "custom",
] as const;
/** Union of {@link reminderTypeEnum} literals. */
export type ReminderType = (typeof reminderTypeEnum)[number];

/** Urgency of a reminder. */
export const reminderPriorityEnum = ["low", "medium", "high"] as const;
/** Union of {@link reminderPriorityEnum} literals. */
export type ReminderPriority = (typeof reminderPriorityEnum)[number];

/** Lifecycle of a user reminder (pending → done / dismissed). */
export const reminderStatusEnum = ["pending", "done", "dismissed"] as const;
/** Union of {@link reminderStatusEnum} literals. */
export type ReminderStatus = (typeof reminderStatusEnum)[number];

/**
 * Manually created reminders. `relatedItemKind` / `relatedItemId` are a
 * polymorphic soft reference (no DB FK) — orphaned links are allowed.
 */
export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vesselId: uuid("vessel_id").references(() => vessels.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    type: text("type", { enum: reminderTypeEnum }).notNull(),
    relatedItemKind: text("related_item_kind"),
    relatedItemId: uuid("related_item_id"),
    priority: text("priority", { enum: reminderPriorityEnum })
      .notNull()
      .default("medium"),
    reminderDate: date("reminder_date").notNull(),
    status: text("status", { enum: reminderStatusEnum })
      .notNull()
      .default("pending"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("reminders_vessel_id_idx").on(t.vesselId),
    index("reminders_status_idx").on(t.status),
    index("reminders_reminder_date_idx").on(t.reminderDate),
    index("reminders_type_idx").on(t.type),
  ],
);

/** A row as read from {@link reminders}. */
export type ReminderRow = typeof reminders.$inferSelect;
/** Shape accepted by Drizzle's `.insert()` for {@link reminders}. */
export type ReminderInsert = typeof reminders.$inferInsert;
