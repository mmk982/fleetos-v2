# FleetOS — Build Plan

> Status: **FINAL — FULLY RESOLVED, AWAITING BUILD GO-AHEAD.** No implementation
> code has been written. This document specifies schemas, validation, server
> actions/API routes, and pages per module. **All decisions in §0 and §1, and all
> module-local choices in §2–§7, are settled — there are no open questions left.**
> This is not permission to build; wait for an explicit instruction to start.
>
> **Revision note (1):** the database engine changed from SQLite to
> PostgreSQL after this plan was first finalized (see the "Database engine"
> section immediately below for why). Every schema/type/driver reference
> throughout this document reflects that change; no other decision was
> reopened.
>
> **Revision note (3):** a second source document, "نظام إدارة أسطول.pdf"
> (a wireframe + normalized database-structure document from a ship
> management company, cross-validating "required in details.docx"), added
> further refinements: a `monthly_form_requirements` table replacing the
> earlier ad-hoc "generate checklist" mechanism (§10), a persisted
> `notifications` table (§14, new), an `activity_logs` schema resolving the
> Dashboard "Recent activity" open item (§6), `isCurrentVersion` on manual
> revisions, and standardized multi-file attachment tables across ISM
> Templates/Drawings/Deficiencies/Insurance (previously single-file
> columns). **Explicitly not adopted:** that document's much simpler
> flat-`reminder_days`-per-certificate model — our `certificate_types` +
> rule-kind + window + event-history design stays, since it's grounded in
> real certificate evidence (the GLIMLIT archive) that the simpler draft
> didn't have.
>
> **Revision note (2):** this plan now incorporates "required in
> details.docx," a UI/UX requirements document for a from-scratch rebuild
> ("Fleet OS 2") — the original app was confirmed never to have been a real,
> running production app. That document is now the authoritative source for
> product scope; where it conflicts with earlier assumptions drawn from the
> old app's docs, the requirements doc wins. It added: an extension to
> Vessels for Ship Particulars (§13), and four new modules — Manuals (§8),
> ISM Templates (§9), Monthly Executed Forms (§10), Drawings (§11), and
> Reminders (§12, confirmed **separate** from the Alerts aggregator, not a
> rename of it). It also changed Deficiencies to a 4-state status model
> (§2, revised) and added a per-certificate reminder-days override (§1,
> revised). Crew stays in the plan (confirmed, despite not appearing in the
> new requirements doc). The already-resolved architecture — the expiry
> engine, the Postgres decision, the RBAC layering approach — is unchanged;
> this only adds scope. *(The delete-semantics decision referenced here was
> itself later revised — see Revision note (4).)*
>
> **Revision note (4):** an independent Cursor review of this document (run
> in-editor, review-only, no build authorized) surfaced real internal
> inconsistencies once the plan grew to its Fleet OS 2 scope. Verified
> against the file directly and fixed: (a) **§0.9 delete semantics
> replaced** — the original single fleet-wide `RESTRICT` rule didn't scale to
> the now-deep table hierarchy and directly conflicted with the
> GDPR-erasure rationale behind choosing Postgres (a user with any logged
> activity could never have been deleted); now split into cross-entity
> RESTRICT / owned-child CASCADE / log-userId SET NULL, with every affected
> FK annotation updated throughout §1–§13; (b) `monthly_form_requirements`'
> redundant `isRequired` column dropped, `activeStatus` is now the single
> source of truth; (c) `monthly_executed_forms.status`'s stored `"overdue"`
> value replaced with a derived (not stored) display status, consistent
> with the engine's derive-don't-store principle; (d) the Deficiencies
> attachment contradiction (schema said multi-file table, prose said
> single-file replace) resolved in favor of the multi-file table, matching
> every other module; (e) several stale wording spots fixed (a stray `30`
> in a code comment that should have read `7`, "open" vs "unresolved"
> deficiency terminology, "ISO `YYYY-MM-DD`" phrasing left over from before
> the Postgres `date`-type migration). No new scope was added; this note
> only records internal-consistency fixes.
>
> **Revision note (5):** a second Cursor review, this time re-reading both
> source documents directly rather than relying on the first pass's
> summary — independently re-verified against the raw extracted text of
> both uploaded PDFs, not taken on faith. Confirmed the plan's fidelity to
> "required in details.docx" on module/field coverage, and fixed three real
> gaps: (a) **issuing authority** — the docx makes it a required filter
> (§6) but the plan stored it as free text; replaced with a seeded,
> user-extensible `issuing_authorities` table, same pattern as
> `certificate_types` (§1); (b) **Ship Particulars history** — the plan had
> flattened this to columns on `vessels`, but the PDF's own schema models a
> separate `vessel_particulars` table recommending "one latest active
> record per vessel"; switched to a new `vessel_particulars` table with an
> `isCurrent` flag, matching the `manual_revisions` pattern (§13, you
> confirmed following the more future-proof design); (c) **status colors**
> — the docx specifies exactly 3 (Green/Yellow/Red, §17) but the engine
> derives 6 statuses with no defined mapping; resolved as the 3 docx colors
> plus a 4th neutral gray for `unknown`/`revoked` (engine section). Also:
> added the requested one-paragraph delineation of Alerts vs. Reminders vs.
> Notifications (cross-cutting notes), widened the permission-mapping open
> item from one pairwise boundary to its true 5-role × 3-tier scope (§7a),
> and upgraded "Export to Excel/PDF" from an unassigned deferral to a
> tracked build step (build order). Two other items this review flagged —
> the delete-policy split (Revision note (4)) and the Alerts/Reminders/
> Notifications three-way split — were already explicit decisions from
> earlier in this process, not silent assumptions; confirmed standing, not
> reopened.
>
> **Revision note (6):** explicit standing note from you — this is an MVP
> for real-life testing with a real ship management company, and the app
> structure needs to support substantial future development, not just
> this v1 scope. Researched current MVP-for-extensibility practice before
> changing anything (see `MASTER_PLAN.md`'s new "Product philosophy"
> section for the full reasoning and sources). Net effect here: (a)
> **Settings (§7a) becomes a generic key-value table**, not fixed typed
> columns — new settings post-launch won't need a migration each; (b) a
> new **"MVP scope cuts / v2 backlog"** section (below, before Status)
> consolidates every deliberately-deferred item into one place. **Confirmed
> already handled, not a gap:** the existing one-VPS-per-customer
> deployment model already gives this the strongest available form of
> future-multi-customer readiness (physical isolation, no `tenant_id`
> retrofit risk) — no schema change needed there. **Deliberately left
> unchanged:** the representative-only seed scope for `certificate_types`/
> `issuing_authorities` (§0.11) — real usage should drive what gets added,
> not upfront guessing. `MASTER_PLAN.md` Phase 2 also gained basic
> observability (structured logs + error tracking) as MVP scope rather
> than a later nice-to-have, since a real company will depend on this
> operationally from day one.
>
> **Revision note (7):** a third Cursor review, checking the previous
> round's changes for integration bugs and re-examining the plan against
> the MVP-extensibility philosophy specifically. Verified against the file
> directly before acting; all findings held up. Fixed: (a) a genuine
> leftover bug — `isSqliteUniqueError` in the Conventions section, never
> updated after the Postgres migration, now `isPgUniqueViolation`
> (SQLSTATE `23505`); (b) `getAlerts()` was typed as synchronous despite
> doing DB I/O, now correctly `async`/`Promise`, with `criticalDays`
> explicitly resolved once via `getCriticalDays()` and passed through
> rather than re-read per row; (c) the engine's `criticalDays` wording
> loosely implied the pure engine reads Settings directly, corrected to
> make clear only `getCriticalDays()` does that, one layer up; (d)
> `MASTER_PLAN.md`'s OWASP #8 entry still described the old
> RESTRICT-everywhere policy after §0.9 was revised — updated to match.
> Promoted, per your call: **`ism_template_categories`** and **`drawing_
> categories`** from fixed code enums to seeded, user-extensible reference
> tables (§9, §11) — the source PDF already modeled both as tables, so
> this follows documented friction, not a speculative addition, same
> reasoning as `certificate_types`/`issuing_authorities`. Also, per your
> call: **`insuranceTypeEnum`** gained an `"other"` catch-all value (§4).
> Expanded the "MVP scope cuts / v2 backlog" section with four genuine
> deferrals the first pass missed (the free-text-`uploadedBy`-to-FK
> cleanup spanning ~9 tables, P&I noon-GMT precision, `window`-rule-kind
> for non-Certificate modules, DB-touching test coverage). Added a
> `logError(code, context)` **logging seam** to the Conventions section so
> Phase 2's observability decision (Revision note (6)) actually reaches
> every module's controller from day one, not just infrastructure sitting
> unused.

## Database engine: PostgreSQL, not SQLite (revised)

**This plan originally targeted SQLite; that decision has been reversed.**
Reasoning (full writeup in `MASTER_PLAN.md`): SQLite has no built-in
encryption at rest (a real gap against the GDPR-level rigor already locked
in), no row-level security for defense-in-depth under the coming RBAC layer,
and no native point-in-time recovery — all three matter for a compliance app
handling personal crew data, not just a "nice to have." The original app
already validated the replacement pattern (one Docker stack per customer:
app + Postgres + Caddy), so this isn't new operational territory. Every
schema/driver/migration reference below reflects Postgres, not SQLite.

## Conventions this plan follows (extracted from the Vessels module, updated for Postgres)

Every new module mirrors the shipped Vessels feature so the codebase stays
consistent:

- **Schema** lives in `src/db/schema.ts` (single centralized file), using
  `pgTable` (not `sqliteTable`). Primary keys use Postgres's native `uuid`
  type with `.defaultRandom()` (not text + `crypto.randomUUID()`). String
  enums are still declared as `[...] as const` arrays and passed to
  `text(col, { enum })` — Drizzle supports this in `pg-core` too, and it's
  kept deliberately over native Postgres `pgEnum` types because several of
  these enums (`certificate_types` in particular) are meant to grow without
  a schema migration; a native Postgres enum would require `ALTER TYPE` to
  add a value, which defeats that. **Calendar/validity dates** (issue,
  expiry, window open/close, due, closed, date of birth, start date) use
  Postgres's native `date` type — this is a strict upgrade over the old
  SQLite text-based ISO-date workaround, not a departure from it: it still
  stores a pure calendar date with no time-of-day/timezone ambiguity, which
  was the actual reasoning behind the original decision (§0.4), just with
  real type support instead of a text convention. **Audit columns**
  (`createdAt`/`updatedAt`/`uploadedAt`) use Postgres's native `timestamptz`
  with `.defaultNow()`. **Boolean columns** (`isCustom`, `linkedToDryDock`)
  use Postgres's native `boolean` type (not `integer` with a boolean mode).
- **Driver:** `drizzle-orm/node-postgres` with the `pg` package (a
  connection pool, not the single-file-handle model `better-sqlite3` used).
  `drizzle.config.ts` sets `dialect: "postgresql"` with a `DATABASE_URL`
  connection string (`postgres://...`), sourced from the Docker Compose
  Postgres service in dev and each customer's stack in production.
- **Module folder** `src/modules/<feature>/`:
  - `<singular>.model.ts` — re-exported row/insert types, enum re-exports,
    small presentation helpers (e.g. `formatImo`).
  - `<singular>.controller.ts` — `import "server-only"`, plain exported
    functions (no classes) that talk to `getDb()`, typed error classes with a
    `code` field, `isPgUniqueViolation` (checks Postgres error code
    `23505` — **revised from `isSqliteUniqueError`**, a SQLite-era leftover
    caught in review; see Revision note (7)), `nowIso()`, `logError(code,
    context)` (new — the shared logging seam, see below).
  - `validation.ts` — Zod v4 `*CreateSchema` and `*UpdateSchema =
    createSchema.partial()`, exported `*Input` inferred types, `preprocess`
    helpers for coercing form strings.
  - `actions.ts` — `"use server"`, `useActionState`-shaped signature
    `(prev: State | undefined, formData: FormData) => Promise<State>`,
    field-error mapping, `revalidatePath`, `redirect`, `isNextRedirect` guard,
    plus a `delete…FormAction(formData)` for the detail page.
- **API** `src/app/api/<feature>/route.ts` (GET list, POST create) and
  `[id]/route.ts` (GET, PATCH, DELETE). Responses use the `{ data }` envelope,
  `{ error, issues: parsed.error.flatten() }` on validation failure, and the
  status codes 201 / 204 / 400 / 404 / 409.
- **Pages** under `src/app/dashboard/<feature>/`: list (`export const dynamic =
  "force-dynamic"`), `[id]` detail, `new`, `[id]/edit`. A shared client form
  component `<Feature>Form` lives in `src/components/`. Brand color `#0D2B45`.
- **Migrations**: author schema → `npm run db:generate` (drizzle-kit) →
  `npm run db:migrate` (`scripts/migrate.ts`). Migrations auto-run on `predev`
  and `prebuild`.
- **No auth, single-tenant.** No `organizationId` / tenant scoping anywhere.
- **Logging seam** (new, Revision note (7)) — `MASTER_PLAN.md` Phase 2 adds
  an error tracker + structured logging as MVP scope, but that only
  actually happens at the code level if every module calls into it the
  same way; review caught that this convention list didn't say so, so
  observability would have been infra-only, not code-level, by default.
  `src/lib/logging.ts` exports `logError(code: string, context: Record<string,
  unknown>)` — a thin wrapper that both writes a structured log line and
  reports to the error tracker. Every `<singular>.controller.ts` calls it
  in each catch block, same shape as `getCriticalDays()`: a small seam
  every module uses from day one, so there's nothing to retrofit later.
  Pure functions (the expiry engine) don't call it — logging is a
  controller/DB-boundary concern, not the engine's.

Naming note: Vessels uses a singular file prefix for `vessel.model.ts` /
`vessel.controller.ts` but unprefixed `validation.ts` / `actions.ts`. New
modules copy that exact pattern (e.g. `certificate.model.ts`,
`certificate.controller.ts`, `validation.ts`, `actions.ts`).

At implementation time, per the workspace `AGENTS.md`, the Next.js 16
route-handler and Server Action APIs will be re-checked against
`node_modules/next/dist/docs/` before writing code (this plan assumes the same
patterns the Vessels module already uses).

---

## 0. Decisions (all resolved)

These cut across modules. Every item below is now **Decided** — nothing here is
awaiting confirmation.

1. **Shared expiry engine location & name.** *(Decided.)* `src/lib/expiry/` —
   framework-agnostic pure functions, no DB access, importable by controllers,
   aggregators, API routes, and unit tests.
2. **`expiring` vs `critical` escalation split.** *(Decided.)* Reminder timing
   is **per-item** (rule kind + `offsetDays`), replacing the old global
   warning/critical day tiers — see §1 Certificates. A single configurable
   **`criticalDays` (default `7`)** is applied on top of any rule as the
   escalation threshold. Default is **7, not 30**: since most certificate types
   are 30d `expiry_offset`, a 30-day `criticalDays` would make `expiring` and
   `critical` fire on the same day for the majority of types, collapsing the two
   tiers. With 7, a 30d item is `expiring` at 30 days out and escalates to
   `critical` only in the final 7 days; a 180d renewal is `expiring` at 180 days
   out and `critical` in the final 7. Settings can later tune `criticalDays`.
3. **Derived status vocabulary.** *(Decided.)* Single source of truth reused
   everywhere: `valid` → `expiring` → `critical` → `expired` → `unknown`, plus
   **`revoked`**, which overrides all others when a certificate's
   `lifecycleStatus !== "active"` (revoked/superseded). `window`-kind derivation
   is precisely: **`valid`** before `windowOpenDate`; **`expiring`** from
   `windowOpenDate` through the cutoff (`windowCloseDate`, or `expiryDate` if no
   close date exists); **`expired`** once the cutoff passes without the survey
   completed (a class certificate becomes invalid if the survey isn't done within
   the window — so it goes straight to `expired`, not `critical`); **`critical`**
   only in the final `criticalDays` before the cutoff.
4. **Date storage format.** *(Decided — fleet-wide, updated for Postgres.)*
   Every validity/calendar date in **every module** (issue, expiry, window
   open/close, deficiency dates, crew doc dates, insurance dates, event dates,
   etc.) uses Postgres's native **`date`** column type — a pure calendar date
   with no time-of-day/timezone component. This is the same ISO-date
   reasoning as the original decision, now backed by a real type instead of a
   text convention. Audit columns (`createdAt`/`updatedAt`, `uploadedAt`) use
   Postgres's native **`timestamptz`** with `.defaultNow()`. Applies to all
   tables, not just Vessels/Certificates.
5. **Certificate typing.** ~~Free-text vs enum.~~ **Resolved by
   CERTIFICATES_SPEC.md:** `authority` is a fixed 7-value enum, and certificate
   *type* is a DB-backed, seeded, user-extensible `certificate_types` reference
   table (not a hardcoded TypeScript enum). See §1. *(No longer an open
   decision — retained for numbering stability.)*
6. **Survey windows.** ~~Include `nextSurveyDate` or defer.~~ **Resolved for
   Certificates by CERTIFICATES_SPEC.md:** handled via the `window` rule kind +
   editable `windowOpenDate` / `windowCloseDate` on the certificate (see §1).
   Still open for other modules only if they later need survey windows. *(No
   longer an open decision for Certificates.)*
7. **Do deficiencies feed the alerts feed?** *(Decided — included.)*
   Unresolved deficiencies that carry a target closure date (`dueDate`) are a
   **fourth alert source**, alongside certificates, crew documents, and
   insurance. PSC deficiencies carry real closure deadlines and detention
   risk, comparable in urgency to a certificate expiring, and the aggregator
   already generalizes to "anything with a due date." The alerts engine
   derives urgency from `dueDate` (via a fixed `expiry_offset` 30d rule); the
   deficiency's own status (the 4-state `open`/`in_progress`/`closed`/
   `monitoring` model, §2 — "unresolved" means anything not `closed`) is
   unchanged and remains authoritative for the module itself.
8. **Crew ↔ vessel assignment model.** *(Decided.)* A single current `vesselId`
   (nullable) on the crew member (matches "vessel assignment"). No sign-on/
   sign-off assignment *history* in v1.
9. **Delete semantics (fleet-wide, revised — split by relationship type).**
   *(Decided; revises the original single-rule version — see Revision note
   (4).)* Postgres enforces foreign keys natively (no pragma needed, unlike
   SQLite). The original "every FK is `RESTRICT`, no exceptions" rule didn't
   scale once the schema grew a deep ownership hierarchy, and it directly
   conflicted with the GDPR-erasure rationale used to justify Postgres in
   the first place — under the old rule, a user with even one logged
   activity or notification could never be deleted. Replaced with three
   explicit categories, applied per relationship below and reflected in
   every table's FK annotation in §1–§13:
   - **Cross-entity references** — relationships pointing at another
     independent, core-content row: `vesselId` on certificates/deficiencies/
     insurance policies/manuals/drawings/monthly_form_requirements/
     monthly_executed_forms/reminders/notifications; `certificateTypeId`;
     `crewMemberId` on crew_certificates; `ismTemplateId`. Stays
     **`ON DELETE RESTRICT`** — a vessel, certificate type, crew member, or
     template cannot be deleted while real business content still points at
     it; callers must remove or reassign first.
   - **Owned children** — rows that only exist to support their immediate
     parent and carry no independent meaning: every `*_attachments` table,
     `certificate_events`, and `manual_revisions`. Now **`ON DELETE
     CASCADE`** — deleting the parent (a certificate, a manual, etc.)
     deletes its attachments/events/revisions with it; there's nothing
     meaningful left to "remove first."
   - **User references in append-only logs** — `activity_logs.userId` and
     `notifications.userId`. Now **`ON DELETE SET NULL`** (both columns are
     nullable). A user can be deleted without being permanently pinned in
     place by their history; the log/notification row survives as an
     anonymous/system entry. This is what actually delivers the
     GDPR-erasure capability the Postgres decision was justified on.
10. **"Linked to dry dock" flag** *(Decided — from CERTIFICATES_SPEC.md §8).*
    Add **`linkedToDryDock`** as a boolean **on the `certificates` table**
    (per-instance, not on `certificate_types`). When `true`, the certificate's
    **effective `offsetDays` is 180** instead of the type's default. See §1.
11. **Seed scope for `certificate_types`** *(Decided — from CERTIFICATES_SPEC.md
    §8).* Seed with the **representative list from CERTIFICATES_SPEC.md §4 only**.
    Full-archive transcription is deferred; Settings CRUD covers adding more
    later. See §1 Seeding.
12. **Attachment storage** *(Decided — from CERTIFICATES_SPEC.md §8).* Use
    **local storage under `data/attachments/`**, already covered by the existing
    `/data/` `.gitignore` entry. See §1.

---

## Shared building block: the Expiry / Reminder Engine (build FIRST)

This is the reusable core the brief calls out. It must be **date-derived and
authoritative at read time**; any stored status column is a non-authoritative
cache only. Its input model follows CERTIFICATES_SPEC.md's **per-item reminder
rule** (rule kind + `offsetDays` + window dates), not a single global tier —
each consumer supplies the rule, so the engine stays generic (not
certificate-specific).

**Location:** `src/lib/expiry/` (decided, §0.1) — pure functions, **no DB, no
React, no `server-only`** so it can be imported by controllers, aggregators, API
routes, and tested in isolation.

**Public surface (rule model):**

```ts
// Status vocabulary (single source of truth, reused everywhere)
export type ComplianceStatus =
  | "valid" | "expiring" | "critical" | "expired" | "unknown" | "revoked";

// Per-item reminder rule (from certificate_types for certs; fixed for others)
export type ReminderRuleKind = "none" | "expiry_offset" | "window";
export interface ReminderRule {
  kind: ReminderRuleKind;
  offsetDays?: number | null; // used when kind = "expiry_offset" (e.g. 30 or 180)
}

export interface ComplianceInput {
  rule: ReminderRule;
  expiryDate: string | null;
  windowOpenDate?: string | null;   // used when kind = "window"
  windowCloseDate?: string | null;  // used when kind = "window"
  lifecycleStatus?: "active" | "revoked" | "superseded"; // non-active => revoked override
  criticalDays?: number;            // escalation threshold; default DEFAULT_CRITICAL_DAYS (7)
  now?: Date;                       // injectable for tests
}

export interface ComplianceResult {
  status: ComplianceStatus;
  daysRemaining: number | null;         // to expiry, or to windowOpenDate for window-kind
  reference: "expiry" | "window" | "none"; // which date drove the result
}

// Core (pure)
export function deriveComplianceStatus(input: ComplianceInput): ComplianceResult;

// Helpers
export const DEFAULT_CRITICAL_DAYS: number; // 7
export function isActionable(s: ComplianceStatus): boolean; // expiring|critical|expired
export function compareBySeverity(a: ComplianceResult, b: ComplianceResult): number; // worst-first
export const STATUS_LABELS: Record<ComplianceStatus, string>;
export const STATUS_STYLES: Record<ComplianceStatus, string>; // Tailwind badge classes
```

**Status → color mapping** *(new, Revision note (5))* — the requirements
doc specifies exactly 3 colors (§17: Green = Valid, Yellow = Due Soon, Red
= Expired), but the engine derives 6 statuses. Resolved as 3 docx colors
plus a 4th neutral color for the two states that aren't really points on
the valid→expired spectrum, rather than forcing every status into the
literal 3:
- `valid` → **Green**.
- `expiring`, `critical` → **Yellow** (both "due soon"; `critical` is the
  same color but visually distinguished — e.g. bold text or an icon — in
  `STATUS_STYLES`, since it's meaningfully more urgent than plain
  `expiring` even though the docx doesn't call out that distinction).
- `expired` → **Red**.
- `unknown`, `revoked` → **Gray** (deliberately outside the docx's 3-color
  legend: "missing expiry date" and "revoked/superseded" aren't degrees of
  "close to expiring," so folding them into Red or Yellow would misrepresent
  them — this is a considered addition, not scope creep, since hiding a
  revoked certificate's distinct status would be a worse outcome than a
  4th color).

**Derivation rules**

- `lifecycleStatus !== "active"` → **`revoked`** (overrides everything;
  `superseded` also renders as `revoked`).
- `rule.kind === "none"` (permanent) → `valid`, regardless of dates (no reminder).
- `rule.kind === "expiry_offset"`:
  - `expiryDate` null → `unknown`.
  - `daysRemaining < 0` → `expired`.
  - `daysRemaining <= criticalDays` → `critical`.
  - `daysRemaining <= offsetDays` → `expiring`.
  - else `valid`.
- `rule.kind === "window"` (driven by window dates, **not** `expiryDate`). Let
  `cutoff = windowCloseDate ?? expiryDate`:
  - `windowOpenDate` null → `unknown`.
  - `now < windowOpenDate` → `valid`.
  - `now > cutoff` → `expired` (survey not completed within the window → the
    certificate is invalid; it goes straight to `expired`, never `critical`).
  - `now >= (cutoff - criticalDays)` → `critical` (final stretch only).
  - otherwise (from `windowOpenDate` up to that final stretch) → `expiring`.
- Compare against **start of day** to avoid off-by-one at day boundaries.
- `criticalDays` resolved as `caller ?? DEFAULT_CRITICAL_DAYS` **inside the
  pure engine** (default **7**, per §0.2) — the engine itself never reads
  Settings; it only sees whatever number the caller passes in. The
  Settings-aware resolution (`stored ?? DEFAULT_CRITICAL_DAYS`) happens one
  level up, in `getCriticalDays()` (§7a), which controllers/aggregators call
  and pass the result into the engine as `caller`. *(Wording corrected —
  Revision note (7); the original phrasing implied the engine reads
  Settings directly, which would break its "pure, no DB" contract.)* This is
  the only global tuning knob; *when a reminder fires* comes from each
  item's rule.
- No stored status column is ever trusted for logic — controllers may write a
  `cachedStatus` for cheap list rendering/sorting, but every meaningful read path
  recomputes via `deriveComplianceStatus`.

**How each consumer supplies the rule**

- **Certificates:** `rule` (kind + `offsetDays`) comes from the certificate's
  `certificate_types` row; window dates + `lifecycleStatus` from the certificate.
  If the certificate's `linkedToDryDock` is `true`, the controller overrides the
  effective `offsetDays` to **180** before calling the engine (§0.10).
- **Insurance:** fixed `{ kind: "expiry_offset", offsetDays: 30 }` (spec: all
  insurance items are 30d).
- **Crew certificates:** default `{ kind: "expiry_offset", offsetDays: 30 }`
  (per-type refinement possible later).
- **Unresolved deficiencies:** fixed `{ kind: "expiry_offset", offsetDays: 30 }`
  applied to `dueDate` (target closure date), for the alerts feed only — the
  deficiency's stored 4-state status (§2) is separate and authoritative (§0.7).

**Consumed by:** Certificates, Crew certificates, Insurance, open Deficiencies
(via `dueDate`), and the Alerts aggregator.

**Related decisions:** §0.1 (location), §0.2 (critical escalation split),
§0.3 (status names incl. `revoked`) — all resolved.

---

## 1. Certificates

Vessel compliance certificates, grounded in **CERTIFICATES_SPEC.md** (real
archive for m/v GLIMLIT). **Five tables**: two seeded reference tables
(`certificate_types`, and `issuing_authorities` — new, Revision note (5)),
the `certificates` records, a `certificate_events` history log
(extensions/renewals/revocations), and `certificate_attachments`. Certificate
type + reminder rule metadata, and now issuing authority, are **DB-backed,
seeded, and user-extensible** — not hardcoded TypeScript enums or free text.
Reminder/expiry status is derived live by the shared engine using each type's
rule; any `cachedStatus` is a non-authoritative cache. Certificates are
**archivable/revocable, never hard-deleted** in normal use (history must
survive) — deletion is reserved for true mistakes.

### Authority taxonomy (fixed enum)

```ts
certificateAuthorityEnum = ["flag","class","safety","radio","insurance","management","other"]
```

Only 7 stable values (matches the archive's top-level folders), so a real enum.
Distinct from the `issuing_authorities` lookup table (e.g. "NIPPON KAIJI
KYOKAI") described below — `authority` is the broad category, the issuer
is the specific organization.

### Drizzle schema — `issuing_authorities` (new, revised — replaces free-text `issuingAuthorityName`)

The docx makes "Issuing Authority" a required filter (§6, Certificates
module) on the same footing as Vessel/Type/Status — a free-text column
can't support that reliably (real issuers get entered inconsistently:
"NKK" / "ClassNK" / "NIPPON KAIJI KYOKAI" are the same organization).
Fixed by adding a seeded, user-extensible reference table, same pattern
as `certificate_types` (see Revision note (5)):

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `name` | `text` notNull unique | e.g. "NIPPON KAIJI KYOKAI" |
| `isCustom` | `boolean` notNull default `false` | seeded (`false`) vs user-added (`true`) |
| `createdAt` | `timestamptz` notNull | `.defaultNow()` |

- Seeded from the distinct issuer names observed in the GLIMLIT archive
  (representative, same scope philosophy as `certificate_types`, §0.11);
  Settings CRUD adds more later, same as certificate types.
- Managed from Settings (§7a), alongside `certificate_types`.

### Reminder rule model (per certificate *type*, not a global tier)

`reminderRuleKindEnum = ["none","expiry_offset","window"]`:
- **`none`** — permanent (e.g. Carving & Marking); no reminder.
- **`expiry_offset`** — reminder fires `offsetDays` before `expiryDate`. Real
  offsets: **30d** (majority — annual safety/radio/insurance, interim/short-term
  management) and **~180d** (renewals, dry dock, special/renewal survey).
- **`window`** — reminder fires at the editable `windowOpenDate`, for
  class/statutory Annual/Intermediate/Periodical surveys (normally ±3 months of
  the anniversary date; manually overridable).

### Drizzle schema — `certificate_types` (seeded reference table)

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `authority` | `text` enum notNull | `certificateAuthorityEnum` |
| `name` | `text` notNull | e.g. "Cargo Ship Safety Construction" |
| `ruleKind` | `text` enum notNull default `expiry_offset` | `reminderRuleKindEnum` |
| `offsetDays` | `integer` nullable | used when `ruleKind = "expiry_offset"` (e.g. 30 / 180) |
| `isCustom` | `boolean` notNull default `false` | seeded (`false`) vs user-added (`true`) |
| `createdAt` | `timestamptz` notNull | `.defaultNow()` |

- **Unique index on `(authority, name)`** to prevent duplicate types (decided).
- Seeded from CERTIFICATES_SPEC.md §4 (see **Seeding** below); scope is §0.11.

### Drizzle schema — `certificates`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `vesselId` | `uuid` notNull | FK → `vessels.id`, `ON DELETE RESTRICT` |
| `certificateTypeId` | `uuid` notNull | FK → `certificate_types.id`, `ON DELETE RESTRICT` |
| `certificateNumber` | `text` nullable | every real cert has one |
| `issuingAuthorityId` | `uuid` nullable | **revised from free-text `issuingAuthorityName`** — FK → `issuing_authorities.id`, `ON DELETE RESTRICT` (cross-entity reference data, same category as `certificateTypeId`); nullable since not every certificate necessarily has a known issuer on file |
| `issueDate` | `date` nullable | |
| `expiryDate` | `date` nullable | null = permanent |
| `windowOpenDate` | `date` nullable | `window`-kind |
| `windowCloseDate` | `date` nullable | `window`-kind |
| `linkedToDryDock` | `boolean` notNull default `false` | when `true`, effective `offsetDays` = 180 (§0.10) |
| `customOffsetDays` | `integer` nullable | **new** — per-certificate override; when set, takes precedence over both the type's `offsetDays` and `linkedToDryDock` (see below) |
| `lifecycleStatus` | `text` enum notNull default `active` | `["active","revoked","superseded"]` |
| `cachedStatus` | `text` nullable | non-authoritative cache of `ComplianceStatus` |
| `remarks` | `text` nullable | |
| `createdAt` / `updatedAt` | `timestamptz` notNull | `.defaultNow()` |

- Indexes: `vesselId`, `expiryDate`, `certificateTypeId`, `lifecycleStatus`.
- `linkedToDryDock` is a **per-instance** override (not on `certificate_types`):
  the controller swaps the type's `offsetDays` for 180 when it's `true` before
  calling the engine.
- **`customOffsetDays` (new, from "required in details.docx"):** the
  requirements doc's Add/Edit Certificate form has a direct "Reminder Days"
  field on every certificate, implying arbitrary per-certificate overrides,
  not just the two-preset `linkedToDryDock` swap. Precedence when computing
  the effective `offsetDays` passed to the engine: `customOffsetDays` (if set)
  → else `180` if `linkedToDryDock` → else the type's `offsetDays`. The
  Add/Edit Certificate form shows the type's default pre-filled but editable;
  leaving it untouched stores `null` (inherit from type).

### Drizzle schema — `certificate_events` (history log)

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `certificateId` | `uuid` notNull | FK → `certificates.id`, `ON DELETE CASCADE` (owned child, §0.9) |
| `eventType` | `text` enum notNull | `["issued","extended","renewed","revoked"]` |
| `eventDate` | `date` notNull | |
| `newExpiryDate` | `date` nullable | set by `extended`/`renewed` (pushes expiry forward) |
| `note` | `text` nullable | |
| `createdAt` | `timestamptz` notNull | `.defaultNow()` |

- Logs in-place extensions/renewals without losing history (real Class cert had
  two "Occasional Survey for extension" endorsements moving 18 Mar → 30 Apr →
  18 Jun 2026). Applying `extended`/`renewed` updates the certificate's
  `expiryDate`; `revoked` sets `lifecycleStatus = "revoked"`.

### Drizzle schema — `certificate_attachments`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `certificateId` | `uuid` notNull | FK → `certificates.id`, `ON DELETE CASCADE` (owned child, §0.9) |
| `fileName` | `text` notNull | original filename |
| `filePath` | `text` notNull | path under `data/attachments/` (§0.12) |
| `uploadedAt` | `timestamptz` notNull | `.defaultNow()` |

- Multiple PDFs per certificate allowed (original + service report, etc).
- Files stored locally under **`data/attachments/`** (already gitignored via the
  existing `/data/` entry); DB stores the relative path.

### Zod — `validation.ts`

- `certificateTypeCreate/Update`: `authority` enum, `name` (trim, 1–200),
  `ruleKind` enum, `offsetDays` optional positive int (**required when
  `ruleKind = "expiry_offset"`** — cross-field), `isCustom` defaults `true` for
  user-created types.
- `certificateCreate/Update`: `vesselId` uuid, `certificateTypeId` uuid,
  `issuingAuthorityId` optional uuid (**revised from free-text**),
  `certificateNumber`/`remarks` optional-trimmed, the four
  date fields optional ISO-date (shared `isoDateField` helper → `null` on empty),
  `linkedToDryDock` boolean (default `false`), `customOffsetDays` optional
  positive int (new — per-certificate reminder override), `lifecycleStatus`
  enum default `active`. Cross-field: `expiryDate >= issueDate` and
  `windowCloseDate >= windowOpenDate`. `cachedStatus` is **not** user input.
  `certificateUpdateSchema = certificateCreateSchema.partial()`.
- `issuingAuthorityCreate/Update`: `name` (trim, 1–200, unique), `isCustom`
  defaults `true` for user-created entries — same shape as
  `certificateTypeCreate/Update`.
- `certificateEventCreate`: `certificateId` uuid, `eventType` enum, `eventDate`
  ISO (required), `newExpiryDate` optional ISO, `note` optional-trimmed.
- Attachments are validated in the multipart upload action (decided): **max
  10&nbsp;MB** per file and a MIME **allow-list of `application/pdf`,
  `image/jpeg`, `image/png`** — not a JSON body.

### Server actions / API

- **Certificate CRUD** (`actions.ts`): `createCertificateAction`,
  `updateCertificateAction(id, …)`, `deleteCertificateFormAction`. On write,
  recompute `cachedStatus` via the engine using the type's rule.
- **Events**: `addCertificateEventAction` (issued/extended/renewed/revoked) —
  `extended`/`renewed` update `certificates.expiryDate`; `revoked` sets
  `lifecycleStatus`. Recompute `cachedStatus` afterward.
- **Attachments**: `uploadCertificateAttachmentAction` (multipart) and
  `deleteCertificateAttachmentAction`.
- **Certificate types**: CRUD, managed from Settings (§7a) since types are
  reference data; seeded types not deletable while referenced (RESTRICT).
- **Issuing authorities** (new): CRUD, managed from Settings (§7a) alongside
  certificate types; seeded entries not deletable while referenced
  (RESTRICT).
- **API**:
  - `/api/certificates` (GET list — `?vesselId=`, `?authority=`,
    `?issuingAuthorityId=`, `?status=`; POST) + `/api/certificates/[id]`
    (GET/PATCH/DELETE).
  - `/api/certificate-types` (GET/POST) + `/api/certificate-types/[id]`
    (GET/PATCH/DELETE).
  - `/api/issuing-authorities` (GET/POST) + `/api/issuing-authorities/[id]`
    (GET/PATCH/DELETE) — new.
  - Events/attachments are **nested** under a certificate (decided):
    `/api/certificates/[id]/events` and `/api/certificates/[id]/attachments`.

### Pages / UI

- `src/app/dashboard/certificates/` — list (all vessels; columns: vessel, type,
  authority, number, **issuing authority**, expiry/window date, **live status
  badge**; filters by authority / **issuing authority** / status / vessel —
  now a reliable exact-match filter, §6 of the requirements doc), `[id]`
  detail (fields + **events timeline** + **attachments list** with
  add-event / upload controls), `new`, `[id]/edit`.
- `src/components/certificate-form.tsx`, `certificate-event-form.tsx`,
  `certificate-attachments.tsx`. The type `<select>` is grouped by authority;
  the issuing-authority field is now a `<select>` too (was free text); "add
  a new type"/"add a new issuing authority" both route to Settings.
- **Certificate type management UI** lives under Settings (§7a) — it's reference
  data.
- Vessel detail page gains a "Certificates" section (decided): built **after
  both Crew and Insurance ship**, as **one consolidated integration pass** that
  adds per-vessel Certificates / Crew / Insurance sections to the vessel detail
  page together — rather than three separate passes. See build order.
- Status badge derived live via `deriveComplianceStatus` (rule from the type),
  styled by `STATUS_STYLES`; `revoked`/`superseded` shown distinctly.

### Seeding

- Seed `certificate_types` from **CERTIFICATES_SPEC.md §4 (representative list
  only)**, `isCustom = false`, via a seed step in the migration workflow
  (§0.11 — full-archive transcription deferred; Settings CRUD adds more later).
- Seed `issuing_authorities` (new) from the distinct issuer names in the
  GLIMLIT archive, `isCustom = false`, same seed step and same
  representative-not-exhaustive scope as `certificate_types`.

### Decisions (all resolved — no open items)

1. **Date format** — native Postgres `date` type for all validity dates
   (fleet-wide, §0.4); the shared `isoDateField` Zod helper still validates
   `YYYY-MM-DD` string input at the form layer before it reaches the DB.
2. **`certificate_types` uniqueness** — unique index on `(authority, name)`.
3. **Events/attachments API shape** — nested under `/api/certificates/[id]/`.
4. **`certificateTypeId` on-delete** — `RESTRICT` (fleet-wide policy, §0.9).
5. **Attachment upload validation** — multipart action; **max 10&nbsp;MB**;
   MIME allow-list `application/pdf`, `image/jpeg`, `image/png`.
6. **Vessel detail "Certificates" section** — built after Crew and Insurance
   ship, as one consolidated cross-module integration pass (see build order).
7. **Issuing authority storage** *(new, Revision note (5))* — `issuing_authorities`
   lookup table, not free text; makes the docx's required "Issuing Authority"
   filter (§6) an exact-match filter instead of a fragile text search.

---

## 2. Deficiencies (revised — 4-state status + new fields, per "required in details.docx")

Findings linked to a vessel with a source and a richer lifecycle than the
original 2-state design.

### Drizzle schema — `deficiencies`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `vesselId` | `uuid` notNull | FK → `vessels.id`, `ON DELETE RESTRICT` |
| `deficiencyNumber` | `text` nullable | **new** — human-readable reference (e.g. sequential per vessel or per source inspection) |
| `title` | `text` notNull | short summary |
| `description` | `text` nullable | detail |
| `category` | `text` nullable | **new** — free text (the requirements doc lists "Category" as a column without a fixed value set; not turned into an enum since no closed list was given) |
| `source` | `text` enum notNull | `deficiencySourceEnum` |
| `status` | `text` enum notNull default `open` | `deficiencyStatusEnum` — **now 4 states** |
| `reference` | `text` nullable | report/inspection ref |
| `identifiedDate` | `date` nullable | |
| `dueDate` | `date` nullable | target closure date (feeds the alerts engine) |
| `closedDate` | `date` nullable | set when closed |
| `correctiveAction` | `text` nullable | **new** |
| `responsiblePerson` | `text` nullable | **new** — free text for now; revisit as a FK to `crew_members` or the future `users` table once Phase 3 auth exists, rather than inventing that link now |
| `notes` | `text` nullable | |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

### Drizzle schema — `deficiency_attachments` (revised — multi-file standardization)

Originally a single `attachmentPath` column (matching the requirements
doc's singular "Attachment" field); standardized to a dedicated table like
every other module, per the file-attachments decision above.

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `deficiencyId` | `uuid` notNull | FK → `deficiencies.id`, `ON DELETE CASCADE` (owned child, §0.9) |
| `fileName` | `text` notNull | |
| `filePath` | `text` notNull | |
| `uploadedBy` | `text` nullable | free text for now, FK to `users` later |
| `uploadedAt` | `timestamptz` notNull | `.defaultNow()` |

- `deficiencySourceEnum = ["psc", "class", "flag", "internal", "other"] as const`
  (PSC inspection, class audit, flag audit, internal, other).
- `deficiencyStatusEnum = ["open", "in_progress", "closed", "monitoring"] as const`
  — **changed from the original 2-state (`open`/`closed`) model.** `open` and
  `in_progress` both count as "not yet resolved" for alerts purposes (see
  below); `monitoring` means a deficiency that's been actioned but is being
  watched rather than fully closed (e.g. a temporary repair pending permanent
  fix) — still actionable, not dropped from view.
- The module's own state is a real stored status, not date-derived.
- Per §0.7, deficiencies feed the alerts feed as a fourth source — **updated**
  for the 4-state model: any deficiency **not** `closed` (i.e. `open`,
  `in_progress`, or `monitoring`) with a `dueDate` feeds the aggregator, not
  just `status = "open"`. The aggregator derives urgency from `dueDate` via
  the shared engine (fixed `expiry_offset` 30d); the deficiency's own status
  remains the module's authoritative state.

### Zod — `validation.ts`

- Create: `vesselId` uuid, `title` 1–200, `source` enum, `status` enum default
  `open`, `deficiencyNumber`/`category`/`correctiveAction`/`responsiblePerson`
  optional-trimmed, dates optional ISO,
  `reference`/`description`/`notes` optional-trimmed.
- Rule: `status === "closed"` ⇒ `closedDate` defaults to today if omitted.
- Attachment upload follows the same multipart pattern as Certificates (max
  10MB, `application/pdf`/`image/jpeg`/`image/png` allow-list), against the
  `deficiency_attachments` table above — a nested multi-file sub-resource
  like every other module, **not** a single-file replace (that was the
  pre-standardization design; corrected to match the schema, see Revision
  note (4)).
- Update = partial.

### Server actions / API

- Standard CRUD actions + `deleteDeficiencyFormAction`.
- Status transitions: `closeDeficiencyAction(id)` / `reopenDeficiencyAction(id)`
  (reopen now targets `open`, not implicitly the old 2-state toggle) +
  new `startProgressDeficiencyAction(id)` (→ `in_progress`) and
  `setMonitoringDeficiencyAction(id)` (→ `monitoring`) for the expanded model.
- **Attachments** (new — was missing before this fix): `uploadDeficiencyAttachmentAction`
  (multipart) and `deleteDeficiencyAttachmentAction`, same pattern as
  Certificates.
- API: `/api/deficiencies` (list, `?vesselId=`, `?status=` filters; POST) +
  `[id]` (GET/PATCH/DELETE), attachments nested at
  `/api/deficiencies/[id]/attachments` (previously missing from this list —
  the table existed but its endpoint didn't).

### Pages / UI

- `src/app/dashboard/deficiencies/` list / `[id]` / `new` / `[id]/edit`.
- `src/components/deficiency-form.tsx`.
- List shows vessel, deficiency number, source, status pill (4 colors now,
  not 2), due date, responsible person; filter by status/source/category.

### Decisions

- All resolved: 4-state status model (revised from 2-state); non-`closed`
  deficiencies with a `dueDate` feed the alerts feed (§0.7, updated);
  attachments use the standard multi-file `deficiency_attachments` table
  (§2, same pattern as every other module) with `ON DELETE CASCADE`, not a
  single-file replace — corrected, see Revision note (4).

---

## 3. Crew

Crew members with vessel assignment and their own certificates (reusing the
expiry engine).

### Drizzle schema — `crew_members`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `firstName` | `text` notNull | |
| `lastName` | `text` notNull | |
| `rank` | `text` nullable | e.g. Master, Chief Engineer |
| `nationality` | `text` nullable | |
| `dateOfBirth` | `date` nullable | |
| `vesselId` | `uuid` nullable | FK → `vessels.id`, `ON DELETE RESTRICT` (current assignment; unassign before deleting a vessel) |
| `status` | `text` enum notNull default `active` | `crewStatusEnum = ["active","inactive"]` |
| `notes` | `text` nullable | |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

### Drizzle schema — `crew_certificates`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `crewMemberId` | `uuid` notNull | FK → `crew_members.id`, `ON DELETE RESTRICT` |
| `name` | `text` notNull | e.g. STCW II/2, ENG1 Medical, Passport |
| `documentNumber` | `text` nullable | |
| `issuingAuthority` | `text` nullable | |
| `issueDate` | `date` nullable | |
| `expiryDate` | `date` nullable | |
| `cachedStatus` | `text` nullable | non-authoritative engine cache |
| `notes` | `text` nullable | |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

- Index `crew_certificates.crewMemberId` and `expiryDate`.
- Crew certificate expiry uses the **same** `deriveComplianceStatus`, supplying a
  fixed default rule `{ kind: "expiry_offset", offsetDays: 30 }` (per-type
  refinement possible later). `cachedStatus` caches a `ComplianceStatus`.

### Zod — `validation.ts`

- `crewMemberCreate/Update`: names required, `rank`/`nationality`/`notes`
  optional-trimmed, `dateOfBirth`/`vesselId` optional (vesselId uuid|null),
  `status` enum.
- `crewCertificateCreate/Update`: `crewMemberId` uuid, `name` required, dates
  optional ISO with `expiryDate >= issueDate` rule.

### Server actions / API

- Crew certificates live within the crew module in
  `src/modules/crew/crew-certificate.controller.ts` (decided); members in
  `crew.controller.ts`.
- Actions for member CRUD + crew-certificate CRUD (nested under a member).
- API: `/api/crew` + `/api/crew/[id]`; crew certs **nested** (decided) as
  `/api/crew/[id]/certificates` + `.../certificates/[certId]`.

### Pages / UI

- `src/app/dashboard/crew/` list / `[id]` (member detail showing assignment +
  their certificates with live status) / `new` / `[id]/edit`.
- Crew certificate add/edit is **inline** on the member detail page (modal or
  sub-form), not separate top-level routes (decided).
- `src/components/crew-form.tsx`, `src/components/crew-certificate-form.tsx`.

### Decisions

- All resolved: single `vesselId` assignment (§0.8); crew certs nested under the
  member (API + inline UI); crew-certificate controller within the crew module.

---

## 4. Insurance

Insurance policies per vessel; expiry through the shared engine. Insurance
supplies a **fixed rule** `{ kind: "expiry_offset", offsetDays: 30 }` to
`deriveComplianceStatus` (per CERTIFICATES_SPEC.md — all insurance items are
30d), rather than any per-type table or global tier. `cachedStatus` caches a
`ComplianceStatus`.

### Drizzle schema — `insurance_policies`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `vesselId` | `uuid` notNull | FK → `vessels.id`, `ON DELETE RESTRICT` |
| `policyType` | `text` enum notNull | `insuranceTypeEnum = ["pi","hm","war_risk","fdd","other"] as const` — **`"other"` added, Revision note (7)** (previously a strict 4-value set grounded in CERTIFICATES_SPEC.md's real archive; real fleets sometimes carry policy types outside those 4 — e.g. Loss of Hire, K&R, Charterer's Liability — and a catch-all is cheap to add now vs. a code change + redeploy the first time one comes up) |
| `provider` | `text` nullable | insurer / P&I club |
| `policyNumber` | `text` nullable | |
| `coverageAmount` | `integer` nullable | optional; see below |
| `currency` | `text` nullable | ISO 4217, defaults omitted |
| `startDate` | `date` nullable | |
| `expiryDate` | `date` nullable | renewal date |
| `cachedStatus` | `text` nullable | engine cache |
| `notes` | `text` nullable | |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

- `insuranceTypeEnum` labels: P&I, H&M, War-Risk, FD&D, Other (label map in
  `insurance.model.ts`). `"other"` is a plain catch-all (no free-text
  sub-label field in v1) — if real usage shows recurring "other" types
  worth naming, that's a future case for promoting this to a reference
  table too, same as the two category enums above; not done now since
  there's no documented friction yet, just a hypothetical one.
- P&I policies famously renew **20 Feb noon GMT**; v1 treats `expiryDate` as a
  plain ISO date (no noon-GMT precision) — decided.
- `coverageAmount`/`currency` money fields are **kept, optional** (decided).

### Drizzle schema — `insurance_attachments` (new — multi-file standardization)

Insurance had no attachment support at all before this revision; added per
the file-attachments decision above (policy documents, endorsements, etc.).

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `insurancePolicyId` | `uuid` notNull | FK → `insurance_policies.id`, `ON DELETE CASCADE` (owned child, §0.9) |
| `fileName` | `text` notNull | |
| `filePath` | `text` notNull | |
| `uploadedBy` | `text` nullable | free text for now, FK to `users` later |
| `uploadedAt` | `timestamptz` notNull | `.defaultNow()` |

### Zod — `validation.ts`

- Create: `vesselId` uuid, `policyType` enum, dates optional ISO
  (`expiryDate >= startDate`), `coverageAmount` optional positive int,
  `currency` optional 3-letter, rest optional-trimmed. Update = partial.

### Server actions / API

- Standard CRUD + `deleteInsuranceFormAction`; recompute `cachedStatus` on write
  using the fixed 30d rule.
- API: `/api/insurance` (list, `?vesselId=`, `?policyType=`; POST) + `[id]`,
  attachments nested at `/api/insurance/[id]/attachments`.

### Pages / UI

- `src/app/dashboard/insurance/` list / `[id]` (now shows attachments) /
  `new` / `[id]/edit`.
- `src/components/insurance-form.tsx`.
- Add **Insurance** to the sidebar nav (`dashboard-sidebar.tsx`) — currently
  absent (Certificates is already present; Alerts also to be added).

### Decisions

- All resolved: `expiryDate` as a plain date (no noon-GMT); money fields kept.

---

## 5. Centralized alerts

One aggregator that unifies all expiring items into a single feed.

**Location:** `src/modules/alerts/` with `alerts.controller.ts` (`server-only`)
exposing the aggregator, plus `alerts.model.ts` for the shared `AlertItem` shape.

### Unified item shape

```ts
// four sources: certificates, crew documents, insurance, and unresolved deficiencies (§0.7)
export type AlertKind = "certificate" | "crew_certificate" | "insurance" | "deficiency";

export interface AlertItem {
  kind: AlertKind;
  id: string;                 // source row id
  title: string;              // cert type name, crew doc name, policy type, or deficiency title
  vesselId: string | null;
  vesselName: string | null;
  subjectName: string | null; // crew member name for crew docs, else null
  expiresAt: string | null;   // expiryDate; windowOpenDate for window-kind certs; dueDate for deficiencies
  status: ComplianceStatus;   // from deriveComplianceStatus
  daysRemaining: number | null;
  href: string;               // deep link to the source detail page
}
```

### Aggregator

```ts
export async function getAlerts(options?: {
  kinds?: AlertKind[];
  vesselId?: string;
  statuses?: ComplianceStatus[]; // default: expiring|critical|expired (actionable)
  limit?: number;                // for dashboard preview
}): Promise<AlertItem[]>;
```

- **Revised, caught in review (Revision note (7)):** this was previously
  typed as a synchronous `AlertItem[]` — wrong even before the point
  below, since it already does DB I/O across four source tables. Now
  correctly `async`/`Promise`.
- Resolves `criticalDays` **once** via `getCriticalDays()` (§7a) at the top
  of the function, then passes that single resolved number into every
  `deriveComplianceStatus` call below — not re-read per row.
- Queries four sources (all joined to `vessels`, and crew for names):
  - **certificates** — joined to `certificate_types` for the reminder rule +
    display `name`, filtered to `lifecycleStatus = "active"` so
    revoked/superseded certs never alert;
  - **`crew_certificates`**;
  - **`insurance_policies`**;
  - **unresolved deficiencies** — `status IN ("open", "in_progress",
    "monitoring")` (i.e. anything not `closed`, per the revised 4-state model
    — §2) **with a non-null `dueDate`**; `dueDate` is treated as the
    effective date.
- Maps each through `deriveComplianceStatus`, passing the correct rule per source
  (certificate → its type's rule + window dates; insurance → fixed 30d; crew →
  default 30d; deficiency → fixed 30d on `dueDate`) and the resolved
  `criticalDays`. Filters to actionable statuses by default, sorts
  worst-first via `compareBySeverity` (expired → critical → expiring, then
  soonest date).
- Pure derivation at read time (cache columns are never trusted here).
- No new table (deficiencies contribute via their existing row + `dueDate`).

### Pages / UI

- `src/app/dashboard/alerts/page.tsx` — full feed with kind/vessel/status
  filters, grouped or sorted worst-first.
- Reusable `src/components/alerts-list.tsx` used by both the full page and the
  dashboard preview.
- Add **Alerts** to the sidebar.

### Decisions

- All resolved: deficiencies **included** as a fourth source — unresolved
  deficiencies (`open`/`in_progress`/`monitoring`, per the revised 4-state
  model) with a `dueDate` (§0.7); default filter = actionable
  (`expiring | critical | expired`); `unknown` (missing-date) items surface in a
  separate "Missing dates" section, not the main severity list. (Deficiencies
  without a `dueDate` are not date-derivable, so they don't enter the feed.)

---

## 6. Dashboard (revised — cards now match "required in details.docx" exactly)

Replace the placeholder `src/app/dashboard/page.tsx` with real fleet health,
sourced from the alerts aggregator + lightweight counts. The requirements doc
specifies the summary cards precisely — this supersedes the earlier generic
"fleet size / expired / expiring soon / open deficiencies" set.

### Data sources

- Counts: total vessels, total certificates by status (valid / due soon /
  expired, via `certificate_types`-joined `deriveComplianceStatus`), missing
  monthly forms (from Monthly Executed Forms, §10 — rows with stored
  `status = "pending"` for the current month, whose derived
  `deriveMonthlyFormDisplayStatus` may show as "pending" or "overdue" —
  §10), open deficiencies, total manuals (§8) — simple `count()` helpers
  per controller.
- Health: `getAlerts()` bucketed by `status` (expired / critical / expiring
  totals) and by `kind`.
- Preview tables: `getAlerts({ kinds: ["certificate"], limit: N })` for
  "Certificates due soon"; `getAlerts({ kinds: ["deficiency"], limit: N })`
  for "Open deficiencies"; a small query against Monthly Executed Forms for
  "Missing monthly forms"; `getRecentActivity({ limit: N })` (see below) for
  "Recent activity."

### UI

- Summary stat cards — the two source docs give slightly different card
  sets ("required in details.docx": Valid/Due soon/Expired
  certificates, Missing monthly forms, **Total manuals**, Total vessels;
  "نظام إدارة أسطول.pdf": the same minus Total manuals, plus **Open
  deficiencies**). **Merged to a superset of 7 cards** rather than picking
  one doc over the other, since both are reasonable metrics and neither
  source is more authoritative than the other here: Total vessels, Valid
  certificates, Due soon certificates, Expired certificates, Missing
  monthly forms, Open deficiencies, Total manuals.
- **Certificates due soon** — table (vessel, certificate, expiry date),
  sourced from `getAlerts({ kinds: ["certificate"] })`.
- **Open deficiencies** — table (**new**, from "نظام إدارة أسطول.pdf"'s
  dashboard layout) — vessel, deficiency number, status, due date, sourced
  from `getAlerts({ kinds: ["deficiency"] })`.
- **Missing monthly forms** — table/list of this month's `pending`
  Monthly Executed Forms rows (§10), badge showing the derived
  pending/overdue distinction via `deriveMonthlyFormDisplayStatus`.
- **Recent activity** (updates, uploads, edits) — **resolved** using the
  `activity_logs` schema adopted from "نظام إدارة أسطول.pdf" (replacing the
  earlier minimal `activity_log` proposal):

  | column | type | notes |
  | --- | --- | --- |
  | `id` | `uuid` PK | `.defaultRandom()` |
  | `userId` | `uuid` nullable | **no FK constraint initially** (a FK requires its target table to exist at migration time, and `users` doesn't exist until Phase 3 — a nullable column doesn't change that); early modules log activity under a null/system user. Phase 3 adds `.references(() => users.id, { onDelete: "set null" })` via a follow-up migration once `users` exists, per §0.9's revised log-userId category. |
  | `actionType` | `text` notNull | e.g. `"created"`, `"updated"`, `"uploaded"`, `"closed"` |
  | `moduleName` | `text` notNull | which module (`"certificate"`, `"deficiency"`, etc.) |
  | `recordId` | `uuid` notNull | the affected row's id |
  | `description` | `text` notNull | human-readable summary, e.g. "Added certificate" / "Closed deficiency" |
  | `createdAt` | `timestamptz` notNull | `.defaultNow()` |

  Written to by each module's controller on write. Kept separate from the
  GDPR access log in `MASTER_PLAN.md` Phase 4 — that log is about *who
  accessed what personal data* (a compliance requirement), this one is
  about *what changed* (a product feature); they serve different purposes
  even though both are append-only logs, and conflating them would make the
  GDPR log noisier than it needs to be.
- `export const dynamic = "force-dynamic"` (live data).

### Decisions

- All resolved: 7-card superset (merged from both source docs, decision
  recorded above); "Certificates due soon," "Open deficiencies," and
  "Missing monthly forms" tables; `activity_logs` schema adopted, kept
  separate from the Phase 4 GDPR access log.

---

## 7. Settings + PSC inspections stub

### 7a. Settings

- **Storage shape — generic key-value table, revised from single-row typed
  columns** (MVP-extensibility decision, see `MASTER_PLAN.md` "Product
  philosophy: MVP built for future extension"). Post-launch real usage
  will surface more settings than just `criticalDays`, and a fixed-column
  table means a schema migration for every one of them. Instead:

  | column | type | notes |
  | --- | --- | --- |
  | `key` | `text` PK | e.g. `"criticalDays"` |
  | `value` | `text` notNull | stored as text, cast/validated by the typed accessor that reads it — not by the column type |
  | `updatedAt` | `timestamptz` notNull | `.defaultNow()` |

  Typed accessors wrap each key so callers never touch raw strings:
  `getCriticalDays(): Promise<number>` (feeds the engine — §0.2; falls back
  to `DEFAULT_CRITICAL_DAYS` (7) if the row doesn't exist yet) and
  `setCriticalDays(value: number)`. New settings post-launch get their own
  typed accessor function, not a new column/migration. (Per-item
  *reminder* timing is not here — it lives on each `certificate_types`
  row's rule.)
- **Certificate type management**: Settings is the home for CRUD over
  `certificate_types` (add/edit user types, view seeded ones) — see §1.
- **Issuing authority management** (new, §1): CRUD over
  `issuing_authorities`, same pattern as certificate types.
- **ISM template category management** (new, §9) and **drawing category
  management** (new, §11): CRUD over `ism_template_categories` and
  `drawing_categories` — same seeded/user-extensible pattern, promoted
  from fixed enums in this review round (Revision note (7)).
- **User management**: per "required in details.docx" §16, Settings/Users
  hosts the 5 roles — **Admin, Management User, Superintendent, Vessel User,
  Read Only** (renamed from the earlier Administrator/Superintendent/
  VesselCaptain/VesselUser/ReadOnly list — this requirements doc is now
  authoritative). Full CRUD deferred to `MASTER_PLAN.md` Phase 6 (RBAC layer)
  since it depends on the Phase 3 auth `users` table existing first; the
  full 5-role × 3-tier permission mapping (§16) is not yet defined by the
  source doc and needs a decision when Phase 6 is built.
- Full page: `src/app/dashboard/settings/` with the settings form (starts
  with just `criticalDays`, grows without schema changes) + the
  certificate-types and issuing-authorities tables now; user/role
  management lands once Phase 3/6 exist.
- **Note:** because the engine depends on `criticalDays`, the engine ships with a
  constant first and reads through a `getCriticalDays()` seam from day one, so the
  Settings-backed override lands later with no rework — this seam is
  unaffected by the key-value storage change above, it's still the same
  function signature underneath.

### 7b. PSC inspections (still a stub — not in "required in details.docx")

- Stub only: sidebar entry + placeholder page. Future `psc_inspections` table
  (vessel, port, date, authority, result, detained bool) with deficiencies
  linkable via a `pscInspectionId` FK on `deficiencies`. Not built now; noted so
  the deficiency `source = "psc"` can later link to a real inspection record.
  Unlike Manuals/ISM Templates/Monthly Executed Forms/Drawings (below), this
  one wasn't in the new requirements doc either, so it stays a stub rather
  than getting promoted to a full module.

---

## 8. Manuals (promoted from stub — real spec, per "required in details.docx" §8)

Vessel-linked manuals with revision history (title/type/department stay
stable; each upload is a new revision row, mirroring the
`certificate_events` pattern already used for Certificates).

### Drizzle schema — `manuals`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `vesselId` | `uuid` notNull | FK → `vessels.id`, `ON DELETE RESTRICT` |
| `title` | `text` notNull | Manual Title |
| `manualType` | `text` nullable | free text (no closed list given in the source doc) |
| `department` | `text` nullable | filterable, per the doc |
| `notes` | `text` nullable | |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

### Drizzle schema — `manual_revisions`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `manualId` | `uuid` notNull | FK → `manuals.id`, `ON DELETE CASCADE` (owned child, §0.9) |
| `revisionNumber` | `text` nullable | |
| `revisionDate` | `date` nullable | |
| `filePath` | `text` notNull | |
| `isCurrentVersion` | `boolean` notNull default `true` | **revised** — explicit flag (adopted from "نظام إدارة أسطول.pdf"'s `manual_files.is_current_version`) instead of deriving "current" from most-recent-upload. Lets a mistaken upload be un-flagged without deleting it, or an older revision be re-marked current if needed. |
| `uploadedAt` | `timestamptz` notNull | `.defaultNow()` |

- On inserting a new revision with `isCurrentVersion = true`, the controller
  sets every other revision for the same `manualId` to `isCurrentVersion =
  false` in the same transaction — exactly one current revision per manual
  at a time (enforced in the controller, not a DB constraint, since
  Postgres partial unique indexes for this are more ceremony than it's
  worth at this scale).
- "Add manual" creates a `manuals` row + first revision together; "Upload
  new revision" adds a row to `manual_revisions` only.

### Zod / Server actions / API

- `manualCreate/Update`: `vesselId` uuid, `title` required, `manualType`/
  `department`/`notes` optional-trimmed.
- `manualRevisionCreate`: `manualId` uuid, `revisionNumber`/`revisionDate`
  optional, multipart file upload (same 10MB/PDF+image allow-list pattern as
  Certificates).
- API: `/api/manuals` + `/api/manuals/[id]`, revisions nested at
  `/api/manuals/[id]/revisions` (consistent with the Certificates
  events/attachments nesting decision, §1).

### Pages / UI

- `src/app/dashboard/manuals/` list (filters: vessel, manual type, revision,
  department) / `[id]` detail (shows revision history, "Upload new
  revision") / `new`.
- Add **Manuals** to the sidebar.

---

## 9. ISM Templates (blank forms) — new module, per "required in details.docx" §9

Fleet-wide blank form templates (not vessel-specific — these are the
templates Monthly Executed Forms, §10, are executions of).

### Drizzle schema — `ism_template_categories` (revised — table, not enum; Revision note (7))

The Arabic-source PDF's own schema models this as a reference table
(`ism_template_categories`), not a fixed code enum — matches the same
"real friction already documented by a source doc" reasoning that
promoted `certificate_types`/`issuing_authorities`, so it gets the same
treatment: seeded, user-extensible, editable from Settings without a
redeploy.

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `name` | `text` notNull unique | Drill / Maintenance / Safety / Risk Assessment / Inspection / Reporting (seed, exact docx wording) |
| `isCustom` | `boolean` notNull default `false` | seeded (`false`) vs user-added (`true`) |
| `createdAt` | `timestamptz` notNull | `.defaultNow()` |

### Drizzle schema — `ism_templates`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `formCode` | `text` notNull unique | |
| `formName` | `text` notNull | |
| `categoryId` | `uuid` notNull | **revised from `category` enum** — FK → `ism_template_categories.id`, `ON DELETE RESTRICT` (cross-entity reference data, same category as `certificateTypeId`) |
| `revision` | `text` nullable | |
| `status` | `text` enum notNull default `active` | `["active","superseded","draft"]` — **proposed**, not specified by the source doc; confirm or adjust |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

- **File storage moved to a dedicated table** (multi-file standardization,
  per the cross-referenced database-structure document) — see below.

### Drizzle schema — `ism_template_attachments` (new — multi-file standardization)

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `ismTemplateId` | `uuid` notNull | FK → `ism_templates.id`, `ON DELETE CASCADE` (owned child, §0.9) |
| `fileName` | `text` notNull | |
| `filePath` | `text` notNull | |
| `uploadedBy` | `text` nullable | free text for now, FK to `users` later |
| `uploadedAt` | `timestamptz` notNull | `.defaultNow()` |

### Zod / Server actions / API

- `ismTemplateCreate/Update`: `formCode` unique required, `formName`
  required, `categoryId` uuid required (**revised from enum**), `revision`
  optional, `status` enum.
- `ismTemplateCategoryCreate/Update`: `name` (trim, 1–200, unique),
  `isCustom` defaults `true` for user-created entries.
- API: `/api/ism-templates` + `/api/ism-templates/[id]`, attachments nested
  at `/api/ism-templates/[id]/attachments`; `/api/ism-template-categories`
  (GET/POST) + `/api/ism-template-categories/[id]` (GET/PATCH/DELETE) — new.

### Pages / UI

- `src/app/dashboard/ism-templates/` list (filter by category/status) /
  `[id]` / `new`. Category `<select>` populated from
  `ism_template_categories`; "add a new category" routes to Settings.
- **ISM template category management**: CRUD, managed from Settings (§7a),
  same pattern as certificate types/issuing authorities.
- Add **ISM Templates** to the sidebar.

### Seeding

- Seed `ism_template_categories` from the docx's 6 fixed category names,
  `isCustom = false`, same seed step as `certificate_types`/
  `issuing_authorities` (§0.11 scope philosophy).

---

## 10. Monthly Executed Forms — new module, per "required in details.docx" §10 (mechanism revised)

Per-vessel, per-month tracking of which required forms have been submitted.
The "Generate Monthly Checklist automatically" mechanism is now backed by an
explicit requirements table (adopted from "نظام إدارة أسطول.pdf"'s
`monthly_form_requirements`), replacing the earlier ad-hoc "assume every
template applies to every vessel" proposal — a real improvement, not just an
alternative.

### Drizzle schema — `monthly_form_requirements` (new)

Defines what's actually required, per vessel, independent of any specific
month's execution record.

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `vesselId` | `uuid` notNull | FK → `vessels.id`, `ON DELETE RESTRICT` |
| `ismTemplateId` | `uuid` notNull | FK → `ism_templates.id`, `ON DELETE RESTRICT` |
| `frequency` | `text` enum notNull default `monthly` | `["monthly","quarterly","yearly","on_demand"]` |
| `activeStatus` | `boolean` notNull default `true` | single source of truth for "is this requirement currently in effect" — turn a requirement off without deleting history. *(An earlier draft also had a separate `isRequired` boolean with no defined difference from this one; dropped as redundant — see Revision note (4).)* |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

- Unique constraint on `(vesselId, ismTemplateId)` — one requirement row per
  vessel/template pair.

### Drizzle schema — `monthly_executed_forms`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `vesselId` | `uuid` notNull | FK → `vessels.id`, `ON DELETE RESTRICT` |
| `ismTemplateId` | `uuid` nullable | FK → `ism_templates.id`, `ON DELETE RESTRICT` (nullable for ad-hoc forms not tied to a template/requirement) |
| `formName` | `text` notNull | denormalized copy of the template's name, so history reads correctly even if the template changes later |
| `month` | `integer` notNull | 1–12 |
| `year` | `integer` notNull | |
| `required` | `boolean` notNull default `true` | copied from `monthly_form_requirements.activeStatus` at generation time (a historical snapshot — later toggling the requirement off shouldn't rewrite past months) |
| `uploadedAt` | `timestamptz` nullable | |
| `uploadedBy` | `text` nullable | free text for now — becomes a FK to the `users` table once Phase 3 auth exists |
| `status` | `text` enum notNull default `pending` | `["submitted","pending"]` — **`"overdue"` removed as a stored value** (see below); it's a derived display state, not a real status |
| `remarks` | `text` nullable | |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

- Unique constraint on `(vesselId, ismTemplateId, month, year)` — one row per
  vessel/form/period, preventing duplicate checklist entries.
- **File storage moved to a dedicated table** (standardizing multi-file
  attachments across modules — see below), not a `filePath` column here.

### Drizzle schema — `monthly_executed_form_attachments` (new — multi-file standardization)

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `executedFormId` | `uuid` notNull | FK → `monthly_executed_forms.id`, `ON DELETE CASCADE` (owned child, §0.9) |
| `fileName` | `text` notNull | |
| `filePath` | `text` notNull | |
| `uploadedBy` | `text` nullable | free text for now, FK to `users` later |
| `uploadedAt` | `timestamptz` notNull | `.defaultNow()` |

### "Generate Monthly Checklist automatically" — resolved mechanism

`generateMonthlyChecklist(vesselId?, month?, year?)` queries
`monthly_form_requirements WHERE activeStatus = true` for the given
vessel(s), filtered to requirements due in the target period (`monthly`
always qualifies; `quarterly`/`yearly` qualify only in their due months —
exact due-month logic is a small open detail, e.g. quarterly could anchor to
Jan/Apr/Jul/Oct by default), and inserts a `pending` `monthly_executed_forms`
row for each one not already present for that `(vesselId, ismTemplateId,
month, year)`. Callable on-demand via a "Generate this month's checklist"
button; whether it also needs true cron-based scheduling is still deferred
to `MASTER_PLAN.md` Phase 7, but the underlying data model is now solid
either way — scheduling is just "call this function on a timer" once that
phase exists, not a schema question anymore.

### "Overdue" — derived display status, not stored (fixed, see Revision note (4))

An earlier draft stored `"overdue"` as a real `status` value with no
transition mechanism defined anywhere — nothing ever flipped a row from
`pending` to `overdue`. That's the same "don't store what you can derive"
mistake the whole expiry engine exists to avoid, so it's handled the same
way instead: `status` only ever stores `submitted` or `pending`;
"overdue" is computed at read time.

```ts
// src/modules/monthly-forms/monthly-form-status.ts — pure, no DB
export type MonthlyFormDisplayStatus = "submitted" | "pending" | "overdue";

export function deriveMonthlyFormDisplayStatus(
  status: "submitted" | "pending",
  month: number,
  year: number,
  now: Date = new Date(),
): MonthlyFormDisplayStatus {
  if (status === "submitted") return "submitted";
  // pending is "overdue" once the due period has fully elapsed —
  // i.e. now is past the end of the requirement's due month.
  return now > lastDayOfMonth(year, month) ? "overdue" : "pending";
}
```

Used by the Monthly Executed Forms list/detail pages and the Dashboard's
"Missing monthly forms" card (§6) for the status badge; the underlying
query still filters on stored `status = "pending"`, with "overdue" as
purely a display-layer distinction. For `quarterly`/`yearly` rows, `month`
holds whichever anchor month the due-month logic (still an open detail,
see Status section) assigned the row to — the same end-of-that-month rule
applies.

### Zod / Server actions / API

- `monthlyFormUpdate`: file upload (multipart, sets `status = "submitted"`,
  `uploadedAt`, `uploadedBy`), `remarks` optional, plus multipart file
  upload against `monthly_executed_form_attachments`.
- `monthlyFormRequirementCreate/Update`: `vesselId` uuid, `ismTemplateId`
  uuid, `frequency` enum, `activeStatus` boolean.
- `generateMonthlyChecklistAction(vesselId?, month?, year?)`.
- API: `/api/monthly-forms` (list, `?vesselId=`, `?month=`, `?year=`,
  `?status=`) + `/api/monthly-forms/[id]` + nested
  `/api/monthly-forms/[id]/attachments`. `/api/monthly-form-requirements` +
  `/[id]` for managing what's required per vessel.

### Pages / UI

- `src/app/dashboard/monthly-forms/` list (filters: vessel, month, year,
  form type, status) with a "Generate checklist" action.
- Requirements management (which forms are required per vessel, at what
  frequency) lives under Settings or the vessel profile's Executed Forms
  tab — a small admin table over `monthly_form_requirements`, not a
  top-level sidebar page of its own.
- Add **Monthly Executed Forms** to the sidebar. Feeds the Dashboard's
  "Missing monthly forms" card/table (§6).

---

## 11. Drawings — new module, per "required in details.docx" §11

### Drizzle schema — `drawing_categories` (revised — table, not enum; Revision note (7))

Same reasoning as `ism_template_categories` above: the Arabic-source PDF
models this as a reference table, not a code enum — promoted to match.

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `name` | `text` notNull unique | General Arrangement / Fire Control Plan / Electrical / Machinery / Piping / Safety (seed, exact docx wording) |
| `isCustom` | `boolean` notNull default `false` | seeded (`false`) vs user-added (`true`) |
| `createdAt` | `timestamptz` notNull | `.defaultNow()` |

### Drizzle schema — `drawings`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `vesselId` | `uuid` notNull | FK → `vessels.id`, `ON DELETE RESTRICT` |
| `categoryId` | `uuid` notNull | **revised from `category` enum** — FK → `drawing_categories.id`, `ON DELETE RESTRICT` (cross-entity reference data) |
| `drawingName` | `text` notNull | |
| `drawingNumber` | `text` nullable | |
| `revision` | `text` nullable | still a single mutable field on the drawing row itself (the current revision label) — file **history** now lives in its own table below, standardized with the rest of the app |
| `notes` | `text` nullable | |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

### Drizzle schema — `drawing_attachments` (new — multi-file standardization)

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `drawingId` | `uuid` notNull | FK → `drawings.id`, `ON DELETE CASCADE` (owned child, §0.9) |
| `fileName` | `text` notNull | |
| `filePath` | `text` notNull | |
| `uploadedBy` | `text` nullable | free text for now, FK to `users` later |
| `uploadedAt` | `timestamptz` notNull | `.defaultNow()` |

### Zod / Server actions / API

- `drawingCreate/Update`: `vesselId` uuid, `categoryId` uuid required
  (**revised from enum**), `drawingName` required,
  `drawingNumber`/`revision`/`notes` optional-trimmed.
- `drawingCategoryCreate/Update`: `name` (trim, 1–200, unique), `isCustom`
  defaults `true` for user-created entries.
- API: `/api/drawings` (list, `?vesselId=`, `?categoryId=`) +
  `/api/drawings/[id]`, attachments nested at
  `/api/drawings/[id]/attachments`; `/api/drawing-categories` (GET/POST) +
  `/api/drawing-categories/[id]` (GET/PATCH/DELETE) — new.

### Pages / UI

- `src/app/dashboard/drawings/` list / `[id]` / `new`. Category `<select>`
  populated from `drawing_categories`; "add a new category" routes to
  Settings.
- **Drawing category management**: CRUD, managed from Settings (§7a), same
  pattern as certificate types/issuing authorities/ISM categories.
- Add **Drawings** to the sidebar.

### Seeding

- Seed `drawing_categories` from the docx's 6 fixed category names,
  `isCustom = false`, same seed step as the other reference tables.

---

## 12. Reminders — new module, per "required in details.docx" §14 (confirmed **separate** from Alerts)

Manually created, user-driven reminders — distinct from the auto-computed
Alerts aggregator (§5). Alerts are derived from expiry dates on
Certificates/Crew/Insurance/Deficiencies; Reminders are anything a user
wants to be nudged about, optionally pointing at a related record.

### Drizzle schema — `reminders`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `vesselId` | `uuid` nullable | FK → `vessels.id`, `ON DELETE RESTRICT` — nullable since some reminders are fleet-wide, not vessel-specific |
| `title` | `text` notNull | |
| `type` | `text` enum notNull | `reminderTypeEnum` |
| `relatedItemKind` | `text` nullable | which module the "Related Item" belongs to, if any (e.g. `"certificate"`, `"deficiency"`) — **not** a DB-enforced FK (a polymorphic reference across different tables isn't expressible as a real foreign key); validated at the app layer only |
| `relatedItemId` | `uuid` nullable | id within whichever table `relatedItemKind` names |
| `priority` | `text` enum notNull default `medium` | `["low","medium","high"]` |
| `reminderDate` | `date` notNull | |
| `status` | `text` enum notNull default `pending` | `["pending","done","dismissed"]` — not specified by the source doc, proposed so reminders can be marked handled |
| `notes` | `text` nullable | |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

- `reminderTypeEnum = ["certificate","insurance","manual","deficiency","custom"] as const`
  — loosely mirrors the doc's Reminders examples list (certificate expiry,
  insurance expiry, manual revision, deficiency follow-up) plus a `custom`
  catch-all for anything else.
- Because `relatedItemKind`/`relatedItemId` isn't a real foreign key, a
  reminder pointing at a deleted related item just becomes an orphaned
  reference — the UI should handle a missing related item gracefully
  (show the reminder anyway, without a broken link) rather than erroring.

### Zod / Server actions / API

- `reminderCreate/Update`: `title` required, `type` enum, `priority` enum,
  `reminderDate` required ISO, `vesselId`/`relatedItemKind`/`relatedItemId`
  optional, `notes` optional-trimmed.
- `dismissReminderAction(id)` / `completeReminderAction(id)`.
- API: `/api/reminders` (list, `?vesselId=`, `?type=`, `?status=`,
  `?priority=`) + `/api/reminders/[id]`.

### Pages / UI

- `src/app/dashboard/reminders/` list (filters: vessel, type, priority,
  status) / `new` / `[id]/edit`.
- Add **Reminders** to the sidebar, separate from **Alerts**.
- Dashboard/Notifications (§14 in the source doc, "Notifications System")
  should surface both Reminders and Alerts, clearly distinguished — a
  reminder is something a person set; an alert is something the system
  computed from a date.

---

## 12a. Notifications — new module, adopted from "نظام إدارة أسطول.pdf"'s `notifications` table

The requirements doc only described a notification bell + dropdown (a UI
concept, no persistence). The database-structure document specifies a real
persisted table — adopted, since it supports mark-as-read and a real
history rather than everything being recomputed live on every page load.

### Drizzle schema — `notifications`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `userId` | `uuid` nullable | FK → `users.id`, `ON DELETE SET NULL` (log-userId category, §0.9) — **depends on the Phase 3 auth `users` table existing**, so this module still can't be built before that (the FK itself, not the delete behavior, is what creates the dependency); nullable so a notification survives if its user is later deleted (GDPR erasure) rather than being permanently blocked |
| `vesselId` | `uuid` nullable | FK → `vessels.id`, `ON DELETE RESTRICT` |
| `title` | `text` notNull | |
| `message` | `text` nullable | |
| `notificationType` | `text` enum notNull | `notificationTypeEnum` |
| `isRead` | `boolean` notNull default `false` | |
| `createdAt` | `timestamptz` notNull | `.defaultNow()` |

- `notificationTypeEnum = ["certificate_due","certificate_expired","insurance_due","missing_form","upload","deficiency_update","reminder"] as const`
  — covers the examples from both source docs (due-soon/expired
  certificate, insurance due, missing form, new upload, updated deficiency)
  plus a `reminder` type for when a Reminder (§12) comes due.
- Notifications are generated by each module's controller on the relevant
  event (e.g. `createCertificateAction` doesn't create one, but the daily/
  on-load alerts sweep does, for newly-crossed thresholds) — exact
  generation triggers are an implementation detail to work out when this
  phase is built, not a schema question.
- **Explicit dependency:** unlike every other module in this plan,
  Notifications cannot be built before `MASTER_PLAN.md` Phase 3
  (authentication) exists, since `userId` is a real FK, not a placeholder
  text field like the `uploadedBy` columns elsewhere. Build order (below)
  places it accordingly.

### Zod / Server actions / API

- `markNotificationReadAction(id)` / `markAllReadAction(userId)`.
- API: `/api/notifications` (list, `?userId=`, `?isRead=`) +
  `/api/notifications/[id]`.

### Pages / UI

- Bell icon + dropdown in the top bar (per both source docs), not a
  full-page list — though a `/dashboard/notifications` page for full
  history is reasonable to add alongside it.

---

## 13. Ship Particulars — separate `vessel_particulars` table with history (revised)

Per "required in details.docx" §12, extended with real technical
particulars. **Revised from the original "just add columns to `vessels`"
plan** (see Revision note (5)): the ship-management-company PDF's own
schema explicitly models this as its own `vessel_particulars` table and
recommends *"one latest active particulars record per vessel"* — i.e.
history is a real, intended capability (dimensions/capacities can change
after a conversion, re-measurement, or survey correction, and the old
values shouldn't just be overwritten and lost). You confirmed following
the PDF's more future-proof design here. This is still real schema work
touching the already-shipped, working `vessels` table's neighborhood (same
caveat as the SQLite→Postgres migration in `MASTER_PLAN.md` Phase 2 —
Vessels is real and working today), but the particulars fields themselves
now live in a new child table, not as columns on `vessels` directly.

### Drizzle schema — `vessel_particulars` (new table, revised from columns-on-`vessels`)

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | `.defaultRandom()` |
| `vesselId` | `uuid` notNull | FK → `vessels.id`, `ON DELETE RESTRICT` (cross-entity core content, §0.9 — same category as certificates/deficiencies, not an owned-child attachment) |
| `classSociety` | `text` nullable | e.g. "NIPPON KAIJI KYOKAI" — distinct from the `certificateAuthorityEnum`'s `"class"` category |
| `portOfRegistry` | `text` nullable | |
| `owner` | `text` nullable | |
| `manager` | `text` nullable | |
| `deadweightTonnage` | `integer` nullable | DWT |
| `netRegisteredTonnage` | `integer` nullable | NRT (`vessels.grossTonnage`, already shipped, continues to cover GRT — unchanged, stays on `vessels` since it predates this table) |
| `lengthOverall` | `numeric` nullable | LOA, meters |
| `breadth` | `numeric` nullable | meters |
| `depth` | `numeric` nullable | meters |
| `draft` | `numeric` nullable | meters |
| `mainEngine` | `text` nullable | free-text description |
| `auxEngines` | `text` nullable | free-text description |
| `cargoCapacity` | `numeric` nullable | |
| `ballastCapacity` | `numeric` nullable | |
| `fuelOilCapacity` | `numeric` nullable | |
| `freshWaterCapacity` | `numeric` nullable | |
| `isCurrent` | `boolean` notNull default `true` | **new** — exactly one `true` row per `vesselId` at a time, same enforcement pattern as `manual_revisions.isCurrentVersion` (§8): the controller flips every other record for the same vessel to `false` in the same transaction when a new current record is inserted |
| `effectiveDate` | `date` nullable | when these particulars became accurate (e.g. date of the re-measurement/conversion); optional context, not required to add a history entry |
| `notes` | `text` nullable | e.g. "updated after 2027 dry dock conversion" |
| `createdAt` / `updatedAt` | `timestamptz` notNull | |

- Dimension/capacity fields use Postgres `numeric` (not `integer`) since
  these are physical measurements that can carry decimals (e.g. `161.21`m
  LOA, matching the real GLIMLIT data seen in the Certificates archive) —
  `integer` would silently truncate them.
- No changes to `vesselCreateSchema`'s existing required fields — this is
  purely a new child table, `vessels` itself is untouched by this section.
- **"Upload Particulars PDF" — standardized to a dedicated table**,
  `vessel_particulars_attachments`, per the multi-file-everywhere decision,
  now attached to the **particulars record**, not the vessel directly
  (since a vessel can have several particulars records over time and each
  one may carry its own supporting PDF):

  | column | type | notes |
  | --- | --- | --- |
  | `id` | `uuid` PK | `.defaultRandom()` |
  | `particularsId` | `uuid` notNull | FK → `vessel_particulars.id`, `ON DELETE CASCADE` (owned child, §0.9) |
  | `fileName` | `text` notNull | |
  | `filePath` | `text` notNull | |
  | `uploadedBy` | `text` nullable | free text for now, FK to `users` later |
  | `uploadedAt` | `timestamptz` notNull | `.defaultNow()` |

### Zod / Server actions / API

- `vesselParticularsCreate`: `vesselId` uuid, all fields above optional
  (numbers as optional positive numerics), `effectiveDate` optional ISO,
  `isCurrent` defaults `true`. On insert with `isCurrent = true`, the
  controller sets every other `vessel_particulars` row for the same
  `vesselId` to `isCurrent = false` in the same transaction — exactly one
  current record per vessel, same pattern as Manuals (§8).
- `vesselParticularsUpdate` — partial; editing a record does not change
  `isCurrent` unless explicitly set (editing the current record in place
  vs. adding a new historical entry are both supported — the UI decides
  which action the user meant).
- API: `/api/vessel-particulars` (list, `?vesselId=`, `?isCurrent=`; POST)
  + `/api/vessel-particulars/[id]` (GET/PATCH/DELETE), attachments nested
  at `/api/vessel-particulars/[id]/attachments`.

### Pages / UI

- Vessel Profile page gains a **"Particulars"** tab (alongside the
  General Info / Certificates / Manuals / etc. tabs from the source doc's
  §5) showing the **current** (`isCurrent = true`) record's fields + its
  attachment(s), with a "View history" action listing past records
  (read-only) and an "Update particulars" action that adds a new current
  record rather than overwriting the existing one.
- The sidebar's standalone **"Particulars"** entry (source doc §3) is a
  fleet-wide read view — one row per vessel, joined to each vessel's
  current particulars record — not a separate CRUD module, just a
  different presentation (e.g. a wide table for comparing vessels).

---

## Suggested build order (dependency-aware, revised for Fleet OS 2 scope)

0. **Ship Particulars** (§13, revised — a new `vessel_particulars` table
   with history, incl. `vessel_particulars_attachments`) — independent of
   every other module, do it early so later vessel-profile tab work has
   the fields available. Slightly more than the original "just add
   columns" scope now that it's its own table with the `isCurrent`
   enforcement, but still has no dependencies on anything else.
1. **Expiry/reminder engine** (`src/lib/expiry/`) + `getCriticalDays()` seam.
2. **Certificates** — the largest module: `certificate_types` (+ seed),
   `certificates` (incl. `customOffsetDays`), `certificate_events`,
   `certificate_attachments`, plus the type-select and events/attachments UI.
   First real consumer of the engine.
3. **Deficiencies** (4-state model; own CRUD is engine-independent, but
   unresolved + dated rows become the fourth alerts source in step 8 — so it
   must precede Alerts).
4. **Crew** + crew certificates (second engine consumer).
5. **Insurance** (third engine consumer).
6. **ISM Templates** (§9, incl. `ism_template_attachments`) — no
   dependencies, needed before `monthly_form_requirements`/Monthly Executed
   Forms since both reference templates.
7. **Manuals** (§8) and **Drawings** (§11, incl. `drawing_attachments`) —
   independent of each other and of everything except Vessels; can build in
   parallel.
8. **Monthly Executed Forms** (§10) — `monthly_form_requirements` first
   (depends on ISM Templates, step 6), then `monthly_executed_forms` +
   `monthly_executed_form_attachments`.
9. **Vessel-detail integration pass** — after Crew and Insurance both ship,
   one consolidated pass adding per-vessel Certificates / Crew / Insurance /
   Manuals / Drawings / Particulars sections to the vessel detail page,
   rather than separate passes per module.
10. **Alerts aggregator** (certificates + crew docs + insurance + unresolved
    dated deficiencies) + `/alerts` page + shared `alerts-list`.
11. **Reminders** (§12) — independent of Alerts (confirmed separate
    feature), but sits naturally next to it in the sidebar/UI.
12. **Dashboard** (§6, revised) — consumes the Alerts aggregator + Monthly
    Executed Forms + Deficiencies + Manuals counts; the `activity_logs`
    table (resolved, no longer an open item) can be written to by every
    controller from the start, but the Dashboard's "Recent activity" panel
    itself is built here once there's meaningful activity to show.
13. **Settings** (`criticalDays`, certificate-type management) → then stub
    PSC inspections.
14. **Auth (`MASTER_PLAN.md` Phase 3)** — not part of this feature build
    order, but called out here because two items in this plan explicitly
    depend on it and can't ship before it: **Notifications** (§12a — `userId`
    is a real FK, not a placeholder) and full **user/role management** under
    Settings (§7a).

**15. Export to Excel/PDF** *(upgraded from an open-ended deferral to a
tracked build step, Revision note (5))* — the requirements doc emphasizes
this three separate times (§17 UI requirement, §18 workflow step
"Generates reports," §19 technical expectation), so it's core scope, not
optional polish, even though building it *after* the list-view modules
exist is still the right order. A shared `exportToExcel(rows, columns)` /
`exportToPdf(rows, columns)` utility, applied first to Certificates and
Deficiencies (the two most report-driven lists), then rolled out to the
rest. Timing still sits after step 13 since it needs real list views to
attach to, but it's now an explicit, committed line item rather than an
unassigned "worth doing eventually" note.

Sidebar (`dashboard-sidebar.tsx`) updated as modules land: **Manuals, ISM
Templates, Monthly Executed Forms, Drawings, Particulars, Reminders,
Insurance, Alerts** all need entries (Certificates/Deficiencies/Crew/
Settings already exist). **Notifications** (§12a) is a top-bar bell/dropdown,
not a sidebar entry, per both source docs.

---

## Cross-cutting notes & assumptions

- **Alerts vs. Reminders vs. Notifications** *(new, Revision note (5) —
  requested clarification, not a new decision; the three-way split itself
  was already confirmed earlier)*: three intentionally distinct surfaces,
  even though neither source document names all three separately (both
  docx and PDF only describe Reminders + Notifications; "Alerts" comes
  from the original brief and was explicitly confirmed to stay separate).
  - **Alerts (§5)** — live, derived, **nothing is stored**. Always computed
    at read time from expiry/due dates across Certificates/Crew/Insurance/
    Deficiencies via the shared engine. No user action creates or edits an
    alert; it simply exists whenever a date crosses a threshold.
  - **Reminders (§12)** — a **stored table** of anything a user manually
    creates. Editable, dismissable, optionally linked to a related record.
    Exists independently of whether the engine would also compute an alert
    for the same date.
  - **Notifications (§12a)** — the **per-user delivery/inbox layer**. A
    persisted, mark-as-read record of things surfaced to a specific user,
    which may originate from an Alert crossing a threshold *or* a Reminder
    coming due (`notificationType` covers both — §12a). This is the only
    one of the three tied to a specific user; Alerts and Reminders are not
    user-scoped.
  - A user can end up seeing the "same" upcoming expiry via more than one
    surface (an Alert on the Alerts page, plus a Notification once it's
    generated) — that's intended, not a bug: Alerts is the always-current
    source of truth, Notifications is a point-in-time "you were told"
    record, and Reminders is for anything the system wouldn't otherwise
    know to flag.
- **Foreign keys**: Postgres enforces FK constraints natively (no pragma
  needed, unlike SQLite); the split RESTRICT / CASCADE / SET NULL behavior
  per §0.9 (revised, Revision note (4)) is declared directly on each
  `.references()` call — cross-entity refs stay RESTRICT, owned-child
  tables (`*_attachments`, `certificate_events`, `manual_revisions`) use
  CASCADE, and the two log-userId columns (`activity_logs.userId`,
  `notifications.userId`) use SET NULL.
- **Shared Zod helpers**: `optionalTrimmedString`, `optionalPositiveInt`, and a
  new `isoDateField` will be factored into a small shared validation util reused
  across modules (Vessels currently inlines its own; new modules will share).
  `isoDateField` still validates/coerces `YYYY-MM-DD` strings at the Zod layer
  even though the column itself is now a native `date` type — Zod is
  validating user input before it reaches the DB, not describing storage.
- **No client-side data libs added**; server components + server actions +
  `force-dynamic` lists, matching Vessels. Stack: Next 16, React 19, Drizzle +
  **PostgreSQL** (`node-postgres`, revised from `better-sqlite3`), Zod,
  Tailwind, npm.
- **Local dev & deployment**: PostgreSQL runs via Docker Compose — a
  `docker-compose.yml` (Postgres only) for local dev, matching the original
  app's pattern, and a `docker-compose.prod.yml` (app + Postgres + Caddy) per
  customer VPS for production, per `MASTER_PLAN.md` Phase 7. `DATABASE_URL`
  replaces the old SQLite `file:./data/...` default with a Postgres
  connection string pointing at the Compose service.
- **Testing**: the expiry engine is pure and the prime candidate for unit tests.
  No test runner is configured yet — a lightweight **Vitest** setup will be added
  scoped to `src/lib/expiry` (decided). Module-level tests that touch the DB
  will need a test Postgres instance (e.g. via Docker in CI), unlike SQLite's
  trivial in-memory/file-based test setup — worth accounting for when the
  CI/CD phase (`MASTER_PLAN.md` Phase 2) is built out.

---

## MVP scope cuts / v2 backlog (new, Revision note (6))

Everything below was **deliberately** deferred, not forgotten — consolidated
here in one place per the "build for future extension" principle
(`MASTER_PLAN.md`) so post-launch work is a checklist, not a
reconstruction job. None of this blocks the MVP build; it's what real-life
testing with the ship management company should feed back into first:

- **PSC inspections** (§7b) — sidebar stub only; not in either source doc.
  Real `psc_inspections` table with deficiency linkage is a natural v2 if
  real usage wants it.
- **Notifications (§12a) and full user/role management** (§7a) — both
  structurally blocked on `MASTER_PLAN.md` Phase 3 (auth), not a schema
  gap — they're fully specified, just sequenced after auth exists.
- **Full 5-role × 3-tier permission mapping** (§7a, open item #3) — needs
  a real decision when Phase 6 (RBAC) is built; the docx names the roles
  and tiers but not the mapping.
- **Monthly checklist generation is on-demand, not cron-scheduled** (§10)
  — the data model (`monthly_form_requirements`) is solid either way;
  true scheduling is a `MASTER_PLAN.md` Phase 7 concern, not a v1 gap.
- **Quarterly/yearly due-month anchoring** (§10, open item) — proposed
  calendar-quarter default (Jan/Apr/Jul/Oct), not confirmed against real
  usage patterns yet.
- **`ism_templates.status`, `reminders.status`, `notifications.notificationType`
  enum values** (open items #1, #2, #6) — reasonable proposed defaults,
  not sourced from either requirements doc; cheap to adjust once real
  usage shows what's actually needed.
- **Crew certificate reminder rules are a single fixed 30d default** (§3)
  — real usage may want per-type rules the way Certificates already has
  (§1's `certificate_types.ruleKind`); noted as a possible v2 alignment,
  not built now since the docx didn't ask for it.
- **Ship Particulars history is store-only in v1** (§13) — the new
  `vessel_particulars` table supports it, but the UI only shows a
  read-only history list, not comparison/diff views between records.
- **Export to Excel/PDF** (build order, step 15) — now a tracked
  commitment (Revision note (5)), timing still after the list-view modules
  exist.
- **Certificate/issuing-authority seed data stays representative-only**
  (§0.11, confirmed standing per the MVP philosophy) — Settings CRUD
  covers gaps found during real rollout by design, not as a fallback.
- **The broad "free text now, FK to `users` later" cleanup** (added, review
  round 2 — the most substantive miss from the first backlog draft) — every
  `uploadedBy` column across all `*_attachments` tables plus
  `monthly_executed_forms.uploadedBy`, and `deficiencies.responsiblePerson`
  (§2), are deliberately free text pending Phase 3 auth. This is deferred
  rework spread across roughly 9 tables, not a single item — worth tracking
  as one cleanup pass once `users` exists, rather than rediscovering each
  column separately.
- **P&I noon-GMT renewal precision** (§4, added review round 2) — real P&I
  policies renew at 20 Feb noon GMT specifically; v1 stores `expiryDate` as
  a plain date with no time-of-day precision. Deliberate simplification,
  not an oversight — revisit only if real usage shows the day-level
  granularity actually causes a problem.
- **`window` rule kind for non-Certificate modules** (§0.6, added review
  round 2) — Crew certificates/Insurance/Deficiencies all use fixed
  `expiry_offset` rules; if real usage shows any of them need a
  survey-window-style reminder (open-then-close date range) the way
  Certificates does, that's a conditional future extension, not something
  built speculatively now.
- **DB/module-level automated test coverage** (cross-cutting notes, added
  review round 2) — only the pure expiry engine has unit tests in v1
  scope; tests that touch the database are pushed to whenever
  `MASTER_PLAN.md` Phase 2's CI/CD is fully built out (needs a test
  Postgres instance). Infra deferral, not a product gap, but still a real
  deferral worth tracking.

---

## Status: mostly resolved — a few open items remain

The original §0/§1 decisions and §2–§7 module-local proposals remain fully
resolved. Incorporating both "required in details.docx" and "نظام إدارة
أسطول.pdf" resolved some earlier open items (④ and ⑤ below, struck through)
and left a small remaining set that weren't invented answers for:

1. `ism_templates.status` values (`active`/`superseded`/`draft` proposed, §9)
   — not specified by either source doc.
2. `reminders.status` values (`pending`/`done`/`dismissed` proposed, §12) —
   not specified by either source doc.
3. **Full 5-role × 3-tier permission mapping** (§7a) — *(widened, Revision
   note (5): this was previously tracked narrowly as just "Management
   User vs. Superintendent," but the docx §16 confirms the real scope is
   larger)* the docx names 5 roles (Admin / Management User /
   Superintendent / Vessel User / Read Only) and 3 permission tiers (Full
   control / Limited upload / View only) but never states which role gets
   which tier for which module — the entire mapping is undefined, not just
   one pairwise boundary. Needed when `MASTER_PLAN.md` Phase 6 (RBAC) is
   actually built, not blocking now.
4. ~~The `activity_log` design for Dashboard's "Recent activity."~~
   **Resolved** — the `activity_logs` schema from "نظام إدارة أسطول.pdf" was
   adopted (§6), kept deliberately separate from the Phase 4 GDPR access
   log since they serve different purposes.
5. Whether "Generate Monthly Checklist automatically" needs real cron-based
   scheduling — **mostly resolved**: the data model (`monthly_form_
   requirements`) is now solid regardless of trigger mechanism (§10). One
   small remaining detail: the exact due-month logic for `quarterly`/
   `yearly` frequency requirements (which months they're "due" in) isn't
   specified by either source doc — proposed as calendar-quarter defaults
   (Jan/Apr/Jul/Oct) but not confirmed.
6. `notifications.notificationType` enum values (proposed, §12a) — assembled
   from both docs' examples, not an exact quote from either.
7. `monthly_form_requirements` due-month logic for quarterly/yearly
   frequencies (see ⑤).

Everything else — all schemas, the engine, Certificates (kept richer than
either source doc, per your explicit call), the multi-file attachment
standardization, and the architecture decisions (Postgres, the revised
split delete policy — §0.9, Revision note (4) — RBAC layering) — is
resolved.

**Independent review round (Cursor, in-editor Agent, review-only):** a
full read-through of this document surfaced real internal inconsistencies
that had crept in as the plan grew — verified against the file directly,
not taken on faith, and fixed. See Revision note (4) at the top for the
full list. No new scope was added; this only tightened consistency.

**Second review round, against the actual source documents (Revision note
(5)):** Cursor cross-checked the plan against both uploaded source PDFs
directly (not secondhand); independently re-verified against the raw
extracted text of both files before acting on any of it. Confirmed the
plan's fidelity to the docx on module/field coverage, and surfaced three
real gaps the earlier PDF-only pass couldn't have caught: issuing
authority stored as free text despite being a required filter (fixed —
new `issuing_authorities` table, §1), Ship Particulars flattened onto
`vessels` despite the PDF's own schema wanting history (fixed — new
`vessel_particulars` table with an `isCurrent` flag, §13), and no defined
mapping from the engine's 6 statuses onto the docx's 3-color legend (fixed
— §0's engine section). Also added the requested Alerts/Reminders/
Notifications ownership delineation and widened the permission-mapping
open item to its true 5×3 scope (both cross-cutting notes / open items
above). Two other items Cursor flagged — the delete-policy split and the
Alerts/Reminders/Notifications three-way split — were already explicit
decisions from earlier in this process, not silent assumptions; confirmed
as still standing, not reopened.

**This plan is complete but NOT a go-ahead to build.** No implementation code has
been or will be written until you give explicit instruction to start. Plan
completion is not permission to proceed — awaiting your explicit build command.
