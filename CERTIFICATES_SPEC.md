# Certificates Module — Spec (grounded in real vessel data)

Source: `CERTIFICATE REMINDER SYSTEM – MARINE LOGIC.txt` (the rule document) cross-checked
against a real certificate archive for m/v GLIMLIT (IMO 9589736, 160 files across 6
authority folders). This replaces the guessed thresholds/enum from the original plan
review — every rule below is either quoted from the rule doc or observed directly in a
real certificate.

## 1. Why this differs from the original plan draft

Two things the real files showed that the rule doc alone didn't make obvious:

- **Certificates get extended in place.** The Class Certificate for GLIMLIT has two
  "Occasional Survey for extension" endorsements on the *same document*, each pushing
  the expiry forward (18 Mar → 30 Apr → 18 Jun 2026). Expiry needs to be an editable,
  logged event, not a field that only changes on full renewal.
- **Old certificates are kept, not deleted.** A `REVOKED/` subfolder held superseded
  approval certs; some equipment had two certs for different cycles filed side by side.
  Certificates should be archivable/revocable, never hard-deleted, so history survives.

This also changes the certificate-type decision from the last review. A flat fixed enum
(hardcoded in TypeScript) is too rigid — the real archive has 100+ distinct certificate
types across 6 authorities, and a real operator will need to add types without a code
deploy. So: **authority stays a fixed enum (stable, only 7 values), but certificate type
becomes a database-backed reference table** (`certificate_types`), pre-seeded from this
real data, editable later from Settings.

## 2. Authority taxonomy (fixed enum, confirmed by real folder structure)

`flag | class | safety | radio | insurance | management | other`

This matches the rule doc's "Authority" field and the archive's top-level folders
(`Class certificate/`, `FLAG/`, `SAFETY/`, `RADIO/`, `INSURANCE/`, `MANAGEMENT/`)
exactly.

## 3. Reminder rule model

Every certificate type carries one rule, not a global tier. Three rule kinds cover
everything in the rule doc:

- **`none`** — permanent certificates (e.g. Carving and Marking). No expiry reminder.
- **`expiry_offset`** — reminder fires N days before `expiryDate`. Covers the two
  concrete offsets the rule doc actually specifies: **30 days** (the large majority —
  annual safety/radio/insurance items, interim/short-term management certs) and
  **~180 days** (renewals, dry dock, special survey, class/statutory renewal survey).
- **`window`** — reminder fires when `windowOpenDate` is reached, not a fixed offset
  before expiry. Covers class/statutory Annual, Intermediate, and Periodical surveys.
  The rule doc notes the annual window is "normally ±3 months from anniversary date"
  and that window dates should be manually overridable — so `windowOpenDate` /
  `windowCloseDate` are editable fields on the certificate, not computed.

## 4. Seed data for `certificate_types` (authority → type → rule)

Representative seed (not exhaustive — Settings should let a user add more). Grouped by
authority, cross-checked against real filenames (`CC0x`, `FA0x`, `I0x`, `MP0x` prefixes
in the archive):

**class** (5-year cycle certs, e.g. CC01–CC30 in the archive):
Classification Certificate, Cargo Ship Safety Construction, Load Line, Safety
Equipment, Safety Radio, Oil Pollution Prevention (IOPP), Air Pollution Prevention
(IAPP), IEEC, Sewage Pollution Prevention, Cargo Gear, Grain, Ballast Water Management,
Anti-Fouling, IHM, IHM-EU, IMSBC/DG — all `window` for annual/intermediate, `expiry_offset`
180d for renewal/special survey.

**flag**: Certificate of Registry, Minimum Safe Manning Document, International
Tonnage Certificate, Ship Station Licence, LRIT, Carving and Marking (`none`), Civil
Liability (Bunker/CLC), Wreck Removal Liability, Ship Sanitation Control Exemption,
Medical Chest, Certificate of Inspection, Continuous Synopsis Record (`none` — updated,
not renewed) — mostly `expiry_offset` 30d, a few `none`.

**insurance**: H&M/War Risk, P&I Certificate of Insurance, Bunker Blue Card, Wreck
Removal Blue Card, MLC 2.5.2 Repatriation, MLC 4.2 Liability, FD&D — all `expiry_offset`
30d.

**management**: DOC, SMC, ISSC, MLC, DMLC Part II — `expiry_offset` 30d for
annual/interim/short-term, `window` for intermediate, `expiry_offset` 180d for
renewal/full-term.

**radio**: Radio/GMDSS annual certificate, VDR Annual Performance Test, SSAS test,
AIS test, EPIRB test, SART test, INMARSAT C — all `expiry_offset` 30d. Battery/HRU
sub-items (EPIRB battery, EPIRB HRU, SART battery, VHF portable battery, AIS-SART
battery, liferaft HRU) tracked as their own rows, same rule.

**safety**: Fire Extinguisher Inspection, CO2 System, SCBA/EEBD, Medical Oxygen,
Immersion Suits, Fireman's Outfit, Water Mist/Sprinkler, Foam System, OWS/15PPM, Gas
Detector Calibration, Gyro/Magnetic Compass Service — `expiry_offset` 30d. Lifeboat/
Rescue Boat Annual Service, Davit/Winch/Hook Service — `expiry_offset` 30d. Lifeboat/
Rescue Boat Load Test — `expiry_offset` 30d normally, `expiry_offset` 180d when linked
to dry dock/renewal (flag this as a manual override case, not automatic).

## 5. Required fields (rule doc's list + what real certificates actually carry)

Vessel, Certificate Type (→ `certificate_types`), Certificate Number *(new — every real
cert has one, the rule doc's field list omitted it)*, Issuing Authority Name (free text,
e.g. "NIPPON KAIJI KYOKAI" — distinct from the fixed `authority` category), Issue Date,
Expiry Date (nullable for permanent), Window Open/Close Date, Lifecycle Status
(active/revoked/superseded), Derived Status (computed, never stored as source of
truth), Remarks, Attachment(s).

## 6. Drizzle schema sketch (revised for PostgreSQL — see `PROJECT_PLAN.md`)

**Note:** this sketch originally used `sqliteTable`/text-based dates. The
database engine was later changed from SQLite to PostgreSQL (reasoning in
`MASTER_PLAN.md`); the version below reflects that. `PROJECT_PLAN.md` is the
authoritative, fully-resolved version of this schema — this file stays as
the original real-data reasoning behind it.

```ts
import { pgTable, uuid, text, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";

export const certificateAuthorityEnum = [
  "flag", "class", "safety", "radio", "insurance", "management", "other",
] as const;

export const reminderRuleKindEnum = ["none", "expiry_offset", "window"] as const;

export const certificateTypes = pgTable("certificate_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  authority: text("authority", { enum: certificateAuthorityEnum }).notNull(),
  name: text("name").notNull(),
  ruleKind: text("rule_kind", { enum: reminderRuleKindEnum }).notNull().default("expiry_offset"),
  offsetDays: integer("offset_days"), // used when ruleKind = "expiry_offset"
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const certificateLifecycleEnum = ["active", "revoked", "superseded"] as const;

export const certificates = pgTable("certificates", {
  id: uuid("id").defaultRandom().primaryKey(),
  vesselId: uuid("vessel_id").notNull().references(() => vessels.id),
  certificateTypeId: uuid("certificate_type_id").notNull().references(() => certificateTypes.id),
  certificateNumber: text("certificate_number"),
  issuingAuthorityName: text("issuing_authority_name"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  windowOpenDate: date("window_open_date"),
  windowCloseDate: date("window_close_date"),
  lifecycleStatus: text("lifecycle_status", { enum: certificateLifecycleEnum }).notNull().default("active"),
  cachedStatus: text("cached_status"), // non-authoritative — always derive via the expiry engine for display
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// logs extensions/renewals against a certificate without losing history
export const certificateEvents = pgTable("certificate_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  certificateId: uuid("certificate_id").notNull().references(() => certificates.id),
  eventType: text("event_type", { enum: ["issued", "extended", "renewed", "revoked"] }).notNull(),
  eventDate: date("event_date").notNull(),
  newExpiryDate: date("new_expiry_date"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const certificateAttachments = pgTable("certificate_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  certificateId: uuid("certificate_id").notNull().references(() => certificates.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});
```

## 7. Derived status (expiry engine)

`valid → expiring → critical → expired → unknown`, plus `revoked` which overrides
everything else when `lifecycleStatus !== "active"`. For `window`-kind certificates,
"expiring"/"critical" are driven by proximity to `windowOpenDate`, not `expiryDate`.

## 8. Still open — needs your input, not invented

- Exact offsetDays split isn't fully explicit for every item (e.g. lifeboat load test
  "unless linked to dry dock" is a manual per-record override, not a rule-table value —
  worth a boolean flag like `linkedToDryDock` on the certificate row that swaps
  30d → 180d).
- Whether `certificate_types` ships seeded from this spec's list only, or you want the
  full real archive (~100+ items) transcribed in — happy to do that as a follow-up if
  you want the seed list to be comprehensive rather than representative.
- Attachments: real certs are PDFs (sometimes several per certificate — e.g. the
  original + a service report). Confirm local file storage under something like
  `data/attachments/` is fine for now versus needing anything more robust.
