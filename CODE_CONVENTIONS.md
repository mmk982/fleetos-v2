# FleetOS — Code Documentation Conventions

Purpose: a future programmer (or a future you, six months from now) should be able to open any file in this repo and understand *what it's for* and *why it's shaped the way it is* without reading `PROJECT_PLAN.md`/`MASTER_PLAN.md` end-to-end first, and without asking anyone. This doc is the "declaration" standard every task in `MASTER_IMPLEMENTATION_PLAN.md` and `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` must follow. It's mandatory for both Cursor and Claude Code, not a style preference — code review should reject a PR that skips it the same way it would reject a missing test.

This is a documentation standard, not a design decision — it doesn't change what gets built, only how it's explained once built.

## 1. File header comment

Every file under `src/modules/`, `src/lib/`, `src/db/`, and every shared component under `src/components/ui/` and `src/components/layout/` starts with a block comment stating: what the file is, why it exists (one line linking back to the spec section if one exists), and what it must NOT do (its boundary).

```ts
/**
 * Vessel data-access layer.
 *
 * Every function here talks directly to the database via `getDb()` — this is
 * the only file in the vessels module allowed to import `drizzle-orm` query
 * builders. Callers (Server Actions, API routes) never construct queries
 * themselves; they call these functions and handle the typed errors below.
 *
 * Spec: PROJECT_PLAN.md "Conventions" section — every module's
 * `<singular>.controller.ts` follows this exact shape.
 */
```

Route files (`page.tsx`, `route.ts`) and one-off components get a shorter version — one or two lines is enough since their purpose is usually obvious from the path, but state anything non-obvious (e.g. "renders inside the `@drawer` parallel slot, not directly routable").

## 2. Declare every exported symbol

Every exported function, type, class, and constant gets a doc comment immediately above it — using TSDoc (`/** ... */` with `@param`/`@returns`/`@throws` tags), not a plain `//` line, so editors surface it on hover. State:

- **What it does**, in the first line (a full sentence, not a paraphrase of the name).
- **Why**, if the reason isn't obvious from the name — especially for anything that encodes a business rule from `PROJECT_PLAN.md` (e.g. why `criticalDays` defaults to 7, why `linkedToDryDock` overrides `offsetDays` to 180).
- **`@throws`** for anything that throws a typed error, naming the error class.
- **Don't** document parameter types the compiler already shows (`@param id - the vessel id` is noise) — only add a `@param` line when the *meaning*, not the type, needs explaining (e.g. `@param offsetDays - days before expiry the reminder fires; null means "inherit from certificate_types"`).

Example — the actual style, applied to a real function already in the codebase:

```ts
/**
 * Creates a vessel, normalizing optional fields to `null` for storage.
 *
 * @throws {VesselConflictError} if `imoNumber` collides with an existing
 * vessel — IMO numbers are globally unique, not just per some scope.
 */
export function createVessel(input: VesselCreateInput): VesselRow {
  // ...
}
```

Trivial private helpers (unexported, single-line, name says it all — e.g. `nowIso()`) don't need a comment. If you have to think about whether a helper qualifies as "trivial," it doesn't — document it.

## 3. Business-rule comments live next to the code, not just in the spec

Whenever a piece of code encodes a decision from `PROJECT_PLAN.md`/`CERTIFICATES_SPEC.md`/`MASTER_PLAN.md` that isn't self-evident from reading the code (a magic number, an ordering, an exception case), add an inline comment citing the section, so a future reader isn't left reverse-engineering *why* from the diff alone. This project's spec docs already do this well — carry the habit into the code itself, don't leave it behind in the markdown.

```ts
// criticalDays defaults to 7, not 30 (PROJECT_PLAN.md §0.2): most certificate
// types use a 30d expiry_offset, so a 30-day criticalDays would make
// "expiring" and "critical" fire on the same day for most items.
export const DEFAULT_CRITICAL_DAYS = 7;
```

This matters more here than in a typical app — this codebase has already had several "corrected back to X after cross-checking source docs" reversals (see `PROJECT_PLAN.md`'s Revision notes). A comment citing the deciding section is what stops the *next* well-meaning contributor from "fixing" a deliberate decision back to the wrong default.

## 4. Module-level README for anything with more than one table or a non-obvious flow

Any `src/modules/<feature>/` directory whose schema spans more than one table (e.g. Certificates: `certificate_types` + `issuing_authorities` + `certificates` + `certificate_events` + `certificate_attachments`) gets a short `README.md` in that folder — not a restatement of the schema (that's what `src/db/schema.ts` and `PROJECT_PLAN.md` are for), but the *relationships and flow* a new contributor needs before their first edit:

```md
# Certificates module

Five tables: two seeded reference tables (`certificate_types`,
`issuing_authorities`), the `certificates` records, `certificate_events`
(history log), `certificate_attachments`.

Read order for a new contributor: `certificate.model.ts` (types) →
`certificate.controller.ts` (queries + the dry-dock/custom-offset
precedence logic) → `validation.ts` → `actions.ts`.

Full spec: `PROJECT_PLAN.md` §1.
```

Single-table modules (Vessels) don't need this — the controller file's header comment is enough.

## 5. Shared/foundational code gets the most detail, proportional to blast radius

`src/lib/expiry/`, `src/db/schema.ts`, and every file under `src/components/ui/` are imported by every module — a documentation gap there is multiplied by however many modules consume it. These get full TSDoc on every export, no exceptions, including the ones that look self-explanatory (`isActionable(s)` still gets a line saying which three statuses count as actionable and why unknown/revoked/valid don't).

## 6. What this standard does not require

- No JSDoc on test files beyond a `describe` block naming what's under test.
- No re-explaining a `PROJECT_PLAN.md` section in full inside a code comment — link to the section, don't paste it.
- No comment-for-comment's-sake on genuinely self-describing one-liners (`export const VESSEL_STATUSES = vesselStatusEnum;`).

## 7. Enforcement

This is checked the same way as the visual QA pass in `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` — part of the task's own "done" definition, not a separate cleanup pass. A task that adds an exported function without a doc comment isn't done. `src/modules/vessels/` (see the retrofit applied alongside this doc) is the reference to match.
