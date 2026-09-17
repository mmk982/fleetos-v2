# FleetOS — Master Implementation Plan

> **For agentic workers:** this is the top-level execution plan sequencing everything in `MASTER_PLAN.md` (Phases 0.5–8) and `PROJECT_PLAN.md` (the 15-step feature build order) into concrete, tool-assigned tasks. It does not re-derive specs that already exist in full elsewhere — where a schema/decision is already fully written down, this plan points at the exact section instead of repeating it, so the two documents can't drift out of sync. Steps use checkbox (`- [ ]`) syntax for tracking. Every task in this plan is also governed by `CODE_CONVENTIONS.md` — a task isn't done until its exported code is documented per that standard, not just working.

**Goal:** Take FleetOS from its current state (Vessels module shipped on SQLite, full design spec written, nothing else built) through every phase in `MASTER_PLAN.md` to a deployed, RBAC-secured, documented production app, in dependency order, with each task assigned to whichever of Cursor / Claude Code fits its shape.

**Architecture:** No new architectural decisions are made in this document — `MASTER_PLAN.md` and `PROJECT_PLAN.md` already made and locked every architectural call (Postgres, layered auth, RESTRICT/CASCADE/SET NULL delete policy, the expiry engine, RBAC role list, VPS/backup providers). This plan is purely sequencing + task decomposition + tool assignment on top of decisions already made.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2.4, Drizzle ORM, PostgreSQL (`node-postgres`) once Phase 2 lands (SQLite/`better-sqlite3` today), Zod 4, Tailwind CSS v4, Docker Compose, GitHub Actions, Hetzner + Backblaze B2 (Phase 7).

## Governing documents (read in this order, don't duplicate their content here)

1. `MASTER_PLAN.md` — phase order or record (0.5 → 8), the *why* behind each phase, all resolved open items.
2. `PROJECT_PLAN.md` — every module's exact Drizzle schema, Zod rules, Server Actions/API shape, the shared expiry engine's full interface, the 15-step feature build order, and the fleet-wide conventions (file-naming, delete-policy annotations, logging seam).
3. `CERTIFICATES_SPEC.md` — the real-data grounding for the Certificates module specifically (seed data, reminder rules).
4. `DESIGN_HANDOFF.md` + `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` — the UI layer (tokens, shell, canonical list/drawer/modal patterns) — **Phase 1**, already fully planned as its own document; this plan does not repeat it, only references it where later phases depend on it.
5. `CODE_CONVENTIONS.md` — the documentation/declaration standard every task below must satisfy.
6. `SECURITY_PLAN.md` — the detailed security lens across Phases 3, 4, 6, 7, and 8 below (credential/session mechanics, RBAC enforcement shape, header/rate-limit specifics, incident response outline, and the pre-launch OWASP checklist). Phases 3/4/6/7/8 below point at it rather than repeating its content.

## Two-tool workflow (same split as `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md`, extended)

- **Claude Code** drives: schema/migration work, the expiry engine, every module's backend layer (`model.ts`/`controller.ts`/`validation.ts`/`actions.ts`/API routes), auth/session/RBAC enforcement, CI/CD config, Docker/VPS hardening scripts, and the doc-comment retrofit on each new file. This is all correctness-critical, multi-file-consistency, non-visual work.
- **Cursor** drives: wiring each module's pages/drawers onto the already-built backend using the design-system primitives from Phase 1, and the visual QA pass per module (same reasoning as Phase 1: one-screen-at-a-time, look-at-it-live work).
- **Neither tool** drives: legal/compliance sign-off (GDPR determination, Phase 4's caveat), actual VPS provisioning and DNS changes (Phase 7 — needs Eng.MHD's cloud accounts/credentials), and any RBAC permission-mapping decision that isn't yet sourced from a real requirements document (Phase 6 — flagged below as blocked, not guessed).
- **Git model:** one feature branch per phase (`phase-2-postgres`, `phase-3-auth`, `phase-5-certificates`, etc.), off `master`, merged after Eng.MHD review — same model as `design-system-phase-1`. Don't run two phases' branches through the same files concurrently (e.g. Phase 2's schema migration must merge before Phase 5 module work branches off it).

---

## Phase 0.5 — Version control foundation

**Status: mostly done.** `git remote -v` already points at `github.com/mmk982/fleetos-v2`, and `3d4ed67 ci: add GitHub Actions lint + typecheck workflow` is already in the log. Remaining work is exactly `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 0 (commit the pending `PROJECT_PLAN.md`/`DESIGN_HANDOFF.md` work, add `.gitattributes`, normalize line endings) — not repeated here.

- [ ] Additionally commit this session's new files (`CODE_CONVENTIONS.md`, `MASTER_IMPLEMENTATION_PLAN.md`, the doc-comment retrofit on `src/db/schema.ts`, `src/db/client.ts`, and every file under `src/modules/vessels/`) as part of that same Task 0 cleanup commit, not a separate one — they're all "catch up the repo" work of the same kind.

```bash
git add CODE_CONVENTIONS.md MASTER_IMPLEMENTATION_PLAN.md src/db/schema.ts src/db/client.ts src/modules/vessels/
git commit -m "docs: add CODE_CONVENTIONS.md, master implementation plan; document Vessels module"
```

---

## Phase 1 — Design system

**Fully planned in `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md`.** Not repeated here. Later phases below depend on its outputs (the token layer, `Sidebar`/`TopBar`/`Drawer`/`Modal`/`StatusPill`/`Identifier` primitives, the Login route) — each module task in Phase 5 explicitly calls out that dependency rather than re-describing the primitives.

---

## Phase 2 — CI/CD & environments, Postgres migration

### Task 2.1: SQLite → PostgreSQL migration

Per `PROJECT_PLAN.md`'s "Database engine: PostgreSQL, not SQLite" section and "Conventions" section (schema/driver details already fully specified there — this task executes them, doesn't re-derive them).

**Files:**
- Modify: `src/db/schema.ts` (`sqliteTable` → `pgTable`; `text` id + `crypto.randomUUID()` → native `uuid().defaultRandom()`; `text` dates → native `date`; `text` audit columns → `timestamptz` with `.defaultNow()`; `integer` booleans → native `boolean`)
- Modify: `src/db/client.ts` (`better-sqlite3`/`drizzle-orm/better-sqlite3` → `pg`/`drizzle-orm/node-postgres`, connection pool instead of single file handle)
- Modify: `drizzle.config.ts` (`dialect: "postgresql"`, `DATABASE_URL` connection string)
- Modify: `scripts/migrate.ts` (Postgres migration runner)
- Modify: `package.json` (remove `better-sqlite3`/`@types/better-sqlite3`; add `pg`, `@types/pg`)
- **Modify: `src/modules/vessels/vessel.controller.ts`** — every function is currently written against `better-sqlite3`'s synchronous API (`.all()`, `.get()`, `.run()`); `drizzle-orm/node-postgres` is async-only, so `listVessels`, `getVesselById`, `requireVesselById`, `createVessel`, `updateVessel`, and `deleteVessel` all become `async`/return `Promise<...>`. This was missing from this task's file list in an earlier pass — caught in review (Cursor's independent read of this plan) — and without it the task's own "must land together or the app doesn't build" framing is false, because the ripple below wasn't accounted for.
- **Modify: `src/modules/vessels/actions.ts`** — every call site (`createVessel(parsed.data)`, `updateVessel(id, parsed.data)`, `deleteVessel(id)`) needs `await` once the controller is async.
- **Modify: every Vessels page that calls the controller directly** (`src/app/dashboard/vessels/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`) — `listVessels()`/`getVesselById()` calls need `await`, which most already support structurally (`VesselDetailPage` is already `async`; `VesselsPage`/list page is not yet and needs to become one).
- Create: `docker-compose.yml` (repo root — Postgres-only, for local dev)
- Create: `.env.example` documenting `DATABASE_URL=postgres://...`

**Tool:** Claude Code — this is exactly the "must be correct everywhere at once" class of change: every column type, every FK annotation, the driver swap, and the sync→async ripple through the controller/actions/pages all have to land together or the app doesn't build.

- [ ] Stand up local Postgres via `docker-compose up -d` using the new `docker-compose.yml`.
- [ ] Apply the schema/driver/config changes above to `vessels` (the only table that exists today).
- [ ] Convert `vessel.controller.ts` to `async`/`await` throughout; update `actions.ts` call sites and the pages listed above to match.
- [ ] Regenerate and run migrations: `npm run db:generate && npm run db:migrate`.
- [ ] Manually verify the existing Vessels UI still lists/creates/edits/deletes correctly against Postgres (no automated DB tests exist yet — that's `PROJECT_PLAN.md`'s own noted deferral, see Cross-cutting notes).
- [ ] Add TSDoc updates to `src/db/client.ts` per `CODE_CONVENTIONS.md` — the file header comment already anticipates this migration (see the retrofit done this session); update it to describe the Postgres implementation instead of "expected to change." Note in `vessel.controller.ts`'s header that the sync→async change is part of this migration, not a separate refactor.
- [ ] **New — RLS groundwork decision (raised in Cursor's review, not previously flagged anywhere):** Postgres RLS (planned for Phase 4/6) evaluates against database-session state, not application state. Under a shared connection-pool singleton (today's `getDb()` pattern, carried over from SQLite), there's no per-request place to set `SET LOCAL app.user_id = ...` for RLS policies to read via `current_setting()`. Decide now whether `getDb()` gains a per-request/per-transaction wrapper that sets this session context (the shape RLS actually needs) — deciding it during this migration is far cheaper than retrofitting it after 13 modules' controllers are written against a plain pooled `getDb()`. This doesn't block Task 2.1 itself (Vessels has no RLS policy yet), but the migration's `client.ts` design should leave room for it.
- [ ] Commit: `git commit -m "feat(db): migrate Vessels + schema from SQLite to PostgreSQL"`.

### Task 2.2: Fuller CI/CD — staging environment, deploy approval gate

**Files:** modify `.github/workflows/` (the existing lint+typecheck workflow), add a deploy workflow gated on manual approval, per `MASTER_PLAN.md` Phase 2's "Environments" bullet (staging on your own infra, not a customer VPS).

**Tool:** Claude Code for the workflow YAML; this needs Eng.MHD's actual staging host details to finish, so treat this task as "author the workflow shape now, plug in real secrets/host once Phase 7's Hetzner account exists."

- [ ] Extend CI to run on every push (already exists); add a manually-triggered deploy job scoped to a `staging` environment in GitHub's environment protection rules.
- [ ] Document required secrets (`STAGING_HOST`, `STAGING_SSH_KEY`, etc.) in `.env.example`/README without ever committing real values.

### Task 2.3: Observability — logging seam + GlitchTip

Per `PROJECT_PLAN.md`'s "Logging seam" convention (`src/lib/logging.ts` exporting `logError(code, context)`, called from every controller's catch block) and `MASTER_PLAN.md` Phase 2's GlitchTip decision.

**Files:**
- Create: `src/lib/logging.ts`
- Modify: `src/modules/vessels/vessel.controller.ts` (add `logError` calls to catch blocks — currently has none; this is a real gap against the already-decided convention)
- Create: `docker-compose.yml` gains a `glitchtip` + `redis`/`valkey` sidecar service (dev-time only; production stack is Phase 7)

**Tool:** Claude Code.

- [ ] Write `logError(code: string, context: Record<string, unknown>)` — structured console log now, GlitchTip SDK call once the container exists locally.
- [ ] Retrofit `vessel.controller.ts`'s catch blocks (currently `createVessel`/`updateVessel` catch and rethrow without logging) to call `logError` before rethrowing — this becomes the pattern every Phase 5 module's controller follows from its first commit, per the convention.
- [ ] Document `logError` per `CODE_CONVENTIONS.md` (it's shared/foundational code — full TSDoc, no exceptions, per that doc's §5).

---

## Phase 3 — Simple authentication

Per `MASTER_PLAN.md` Phase 3 (layered defense: edge `proxy.ts` for redirect UX only, every Server Action/Route Handler independently verifies the session, DB access layer as final gate — never middleware-only, per the CVE-2025-29927 note already in `MASTER_PLAN.md`).

**Files:**
- Modify: `src/db/schema.ts` — add `users` (id, name, email unique, passwordHash, role placeholder for Phase 6, `preferredLocale`, `preferredTheme` per `PROJECT_PLAN.md` §14a/§14b, timestamps) and `sessions` (id, `userId` FK **`ON DELETE CASCADE`** — deleting a user invalidates their sessions; this delete policy previously existed only as an annotation in `erd-full-schema.mermaid` with no home in either plan document, now stated here as the actual decision — expiresAt, timestamps) tables.
- **Done (Round 2/3 — history, not a remaining task):** `PROJECT_PLAN.md` was originally written when Auth was build-order step 14 (near-last), so every `uploadedBy` column (on all `*_attachments` tables, `monthly_executed_forms`), `deficiencies.responsiblePerson`, `vessel_notes.authorId`, and `activity_logs.userId` were specified as free text with a "~9-table cleanup pass once `users` exists" tracked as v2-backlog, and `notifications.userId` was marked blocked until `users` exists. Since this plan builds Auth in Phase 3, before any Phase 5 table is created, all of those columns are real `uuid` FKs → `users.id` (`ON DELETE SET NULL`, same log-userId category) from their first migration — there's no "free text now" period to design around. **This has already been applied:** `PROJECT_PLAN.md`'s per-module schema tables (§2, §6, §8–§13) specify the FK directly, the corresponding item was struck from the "MVP scope cuts / v2 backlog" section, and `module-build-order.mermaid`'s Notifications node no longer carries a "BLOCKED" annotation. Nothing further to do here — this bullet is kept as the historical rationale for why those columns look the way they do, not as an open action item.
- Create: `src/lib/auth/password.ts` (argon2 hash/verify), `src/lib/auth/session.ts` (create/validate/rotate session, httpOnly signed cookie, session-ID rotation on login).
- Create: `proxy.ts` (repo root — **not** `middleware.ts`; Next.js 16 renamed it specifically to make clear this is a redirect-only network-boundary layer, per `AGENTS.md`'s Next-16 warning and `MASTER_PLAN.md`'s explicit correction).
- Modify: every existing Server Action (`src/modules/vessels/actions.ts` today) to call the session-verification helper before doing anything — this is the "every Server Action independently verifies" layer; the proxy redirect is UX only.
- Create: `src/modules/auth/` (`actions.ts` for login/logout, `validation.ts`).
- Modify: `src/app/login/page.tsx` (built as static UI in Phase 1) — wire the real `<form action={loginAction}>`.

**Tool:** Claude Code for the schema/session/proxy layer (security-critical, must be consistent across every existing and future Server Action) and Cursor for wiring the already-built Login page's form to the real action (visual/interactive, and it's literally the reference screen Phase 1 already built).

- [ ] Read `node_modules/next/dist/docs/` for the current `proxy.ts` conventions before writing it — per `AGENTS.md`, do not assume the Next-13/14-era `middleware.ts` API surface still applies verbatim.
- [ ] Build `users`/`sessions` schema, migrate.
- [ ] Build `password.ts` (argon2, per `MASTER_PLAN.md`'s explicit "argon2/bcrypt" call), `session.ts` (httpOnly signed cookie, reasonable `maxAge`, rotation on login — no `localStorage`, ever).
- [ ] Build `proxy.ts` — redirects unauthenticated requests to `/login`, nothing more.
- [ ] Add the session-verification call to every existing Server Action (`vessel.actions.ts` today) and require it in every Phase 5 module's `actions.ts` from here on — this becomes part of the Vessels/Certificates reference pattern for all later modules.
- [ ] Wire `src/app/login/page.tsx`'s form to `loginAction`; on success, create a session and redirect to `/dashboard`.
- [ ] Add a rate limit on the login endpoint, both per-IP and per-account (`SECURITY_PLAN.md` §2.4) — a bare "add rate limiting" note previously had no landing checklist item; this is it.
- [ ] Check new passwords against a breached-password list (`SECURITY_PLAN.md` §2.2) before accepting them.
- [ ] Write the break-glass admin-recovery script (`SECURITY_PLAN.md` §2.3) — a direct DB password-reset script kept in an operational runbook, not an app feature — before real accounts exist, since there's no self-service reset in v1.
- [ ] Add the security headers from `SECURITY_PLAN.md` §8.1 (HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`) to every response.
- [ ] Verify `Origin`/`Sec-Fetch-Site` server-side on every mutating Server Action (`SECURITY_PLAN.md` §3) as defense-in-depth alongside Next.js's own same-origin Server Action protections.
- [ ] **New — the third defense layer has no task without this:** `MASTER_PLAN.md` and `auth-request-flow.mermaid` both name "the database access layer as the final gate," but nothing above builds it — proxy/session/password/per-action checks are layers one and two only. At minimum, add a role/ownership check inside the controller layer itself (not just the Server Action calling it), so a bug in one action's session check isn't the only thing standing between a request and the database. Once Phase 6 RBAC and the Task 2.1 RLS groundwork both exist, this is where they attach; until then, this step is the interim third layer.
- [ ] Document every new file per `CODE_CONVENTIONS.md` — `session.ts`/`password.ts` are shared/foundational (§5 of that doc: full TSDoc, no exceptions).

---

## Phase 4 — Database security pass (GDPR)

Per `MASTER_PLAN.md` Phase 4. Some of this is code, some is a written artifact, and one item is explicitly not something either tool can sign off on alone.

- [ ] **Row-level security** (code, Claude Code): write Postgres RLS policies enforcing the Phase 6 vessel-scoping rules once RBAC exists — sequenced *after* Phase 6, not before. **This has a technical prerequisite beyond waiting for role data (raised in Cursor's review, not previously documented anywhere):** RLS policies evaluate against database-session state via `current_setting()`, which means every query needs to run inside a transaction that first sets `SET LOCAL app.user_id = ...`/`app.role = ...` for the current request. The plain pooled `getDb()` singleton (carried over from SQLite, and unchanged by the Task 2.1 Postgres migration unless addressed there) has no per-request place to do this. Confirm during Task 2.1 whether `getDb()` gained the per-transaction wrapper this needs — if not, that's a real blocker to resolve before writing a single RLS policy, not just a "wait for Phase 6" scheduling gap.
- [ ] **Scrub-PII operation** (code, Claude Code): a documented function (e.g. `scrubCrewMemberPii(id)`) that nulls personal fields on a crew member without deleting the row. **Scope note (Cursor's review caught this): must also cover `crew_certificates`** — document numbers and dates on a crew member's certificates (passport, medical, visas) are that same person's PII, not just the fields on `crew_members` itself; an erasure that only scrubs the parent row is incomplete. Build alongside the Crew module in Phase 5, not as a bolt-on later, since it needs to know Crew's exact personal-data columns across both tables.
- [ ] **GDPR access log** (code, Claude Code) — **new this session, closes a real gap:** `MASTER_PLAN.md`'s original Phase 4 text and `SECURITY_PLAN.md` §10 both referenced this log as already decided (and §9's incident-response steps cite it directly), but no schema or task ever existed for it — it was a name, not a design. Now specified in `PROJECT_PLAN.md` §6 (`access_logs` table): logs `view`/`download_attachment`/`export` events against `crew_members`/`crew_certificates`/`crew_certificate_attachments` only (data-minimization scope, matching `scrubCrewMemberPii`'s own scope) — not a general page-view log. Build alongside Crew for the same reason as scrub-PII: it needs Crew's exact read paths, and the export utility (Task 5.4) needs to call into it once it reaches Crew.
- [ ] **Encryption at rest**: not application code — VPS disk-level LUKS, belongs in Phase 7's runbook. Don't attempt to implement this in the app layer.
- [ ] **Breach notification procedure & record of processing activities** (written artifacts, not code): draft these as short docs once real crew data is close to existing (end of Phase 5's Crew module), and have Eng.MHD review — per `MASTER_PLAN.md`'s own caveat, whether these add up to actual GDPR compliance is a legal determination neither tool can make; both tools can draft the technical-controls description, not sign off on compliance.

---

## Phase 5 — Feature build

`PROJECT_PLAN.md`'s "Suggested build order" (its own top-level section, 17 items numbered 0–16 — steps 0–15 are the core sequence, step 16/Email digest was appended separately this session) is the authoritative sequence — reproduced here only as a checklist with tool assignments; the schemas/decisions for each numbered step live in that document's `§0`–`§13`/`§12b`, not duplicated here.

> **Renumbering correction (this session, after Cursor's round-3 review):**
> the table and every step-reference below were still on the pre-renumber
> scheme (Auth at step 14) after `PROJECT_PLAN.md`'s build order moved Auth
> to step 0. Cursor's review caught that my earlier renumbering pass fixed
> `PROJECT_PLAN.md` itself and added a note in Task 5.3, but never actually
> updated this table or the step numbers cited in Tasks 5.1/5.2/5.4 — so
> every step number below except Export (15, unchanged) was still wrong.
> Fixed now; every number below matches `PROJECT_PLAN.md`'s build order.

| # | Module | `PROJECT_PLAN.md` section | Depends on |
|---|---|---|---|
| 0 | Auth | — | **this is Phase 3 above**, built first per `PROJECT_PLAN.md`'s own build order — every module below gets a real session check and a real `users.id` FK from its first commit |
| 1 | Ship Particulars | §13 | Vessels only |
| 2 | Expiry/reminder engine | "Shared building block" section | nothing |
| 3 | Certificates | §1 | engine |
| 4 | Deficiencies | §2 | nothing (but must precede Alerts) |
| 5 | Crew + crew certificates | §3 | engine |
| 6 | Insurance | §4 | engine |
| 7 | ISM Templates | §9 | nothing |
| 8 | Manuals, Drawings | §8, §11 | nothing (parallel) |
| 9 | Monthly Executed Forms | §10 | ISM Templates |
| 10 | Vessel-detail integration pass | (cross-module) | Crew + Insurance shipped |
| 11 | Alerts aggregator | §5 | Certificates, Crew, Insurance, Deficiencies |
| 12 | Reminders | §12 | nothing |
| 13 | Dashboard | §6 | Alerts, Monthly Forms, Deficiencies, Manuals |
| 14 | Settings (`criticalDays`, type management) | §7a | nothing, but needed by most modules' reference-data CRUD |
| 15 | Export to Excel/PDF | build-order note | list-view modules existing |
| 16 | Email digest (new, this session) | §12b | Alerts (hard), Settings on/off toggle (hard) — Notifications is thematically related, not a build dependency (Round 5 correction) |

### Task 5.1: Expiry/reminder engine (step 2 — build first, fully specified below since it's small and everything else depends on it)

**Files:**
- Create: `src/lib/expiry/index.ts` (or split into `types.ts`/`derive.ts`/`helpers.ts` if it grows past a comfortable single-file size — per `CODE_CONVENTIONS.md`'s file-boundary guidance, only split if it actually gets unwieldy)
- Create: `src/lib/expiry/expiry.test.ts` (Vitest — first test in the repo; add `vitest` + a `test` script to `package.json` as part of this task, per `PROJECT_PLAN.md`'s "Testing" cross-cutting note)

**Interfaces:** the exact public surface is already specified verbatim in `PROJECT_PLAN.md`'s "Shared building block: the Expiry / Reminder Engine" section — `ComplianceStatus`, `ReminderRule`, `ComplianceInput`, `ComplianceResult`, `deriveComplianceStatus`, `DEFAULT_CRITICAL_DAYS`, `isActionable`, `compareBySeverity`, `STATUS_LABELS`, `STATUS_STYLES`. Implement exactly that surface — every later module (Certificates, Crew, Insurance, Deficiencies, Alerts) imports these exact names.

**Tool:** Claude Code — pure functions, no DB, the textbook case for writing-plans-style TDD.

- [ ] Write failing tests for each derivation rule already enumerated in `PROJECT_PLAN.md` (`lifecycleStatus !== "active"` → `revoked` overrides everything; `expiry_offset` kind's `expired`/`critical`/`expiring`/`valid` thresholds; `window` kind's `valid`/`expiring`/`expired`/`critical` thresholds including the "expired, never critical" rule when a survey window closes without completion; `rule.kind === "none"` → always `valid`).
- [ ] Implement `deriveComplianceStatus` and the helpers to make the tests pass, per every rule already listed in `PROJECT_PLAN.md`'s "Derivation rules" — don't invent different thresholds; that section is the spec, not a starting point to refine.
- [ ] Run `npx vitest run src/lib/expiry` — all green.
- [ ] Full TSDoc on every export per `CODE_CONVENTIONS.md` §5 (shared/foundational — no exceptions) — in particular, document *why* `criticalDays` defaults to 7 (already drafted as the worked example in `CODE_CONVENTIONS.md` §3) and why the engine never reads Settings directly (`getCriticalDays()` resolves that one layer up, in each consumer's controller).
- [ ] Commit.

### Task 5.2: Certificates (step 3 — the largest module, first real engine consumer)

**Files:** per the reference pattern from Vessels (`PROJECT_PLAN.md` Conventions section) plus this module's exact schema (`PROJECT_PLAN.md` §1, already fully specified: `issuing_authorities`, `certificate_types`, `certificates`, `certificate_events`, `certificate_attachments` — five tables, exact columns, FK annotations, and indexes all listed there):

- Modify: `src/db/schema.ts` — add the five tables from §1.
- Create: `src/modules/certificates/certificate.model.ts`, `certificate.controller.ts`, `validation.ts`, `actions.ts` (naming per the Vessels precedent noted in Conventions: singular-prefixed model/controller, unprefixed validation/actions).
- Create: `src/app/api/certificates/route.ts` + `[id]/route.ts`, plus nested `[id]/events/route.ts` and `[id]/attachments/route.ts` per §1's "nested under a certificate" API decision.
- Create: `src/app/dashboard/certificates/` pages (list, `[id]` detail with events timeline + attachments, `new`, `[id]/edit`) using the Phase 1 primitives (`ListToolbar`, `Drawer`, `StatusPill` mapped to §1's 3-color client status, `Identifier` wrapping certificate/policy numbers).
- Create: `src/components/certificate-form.tsx`, `certificate-event-form.tsx`, `certificate-attachments.tsx`.
- Create: `src/modules/certificates/README.md` per `CODE_CONVENTIONS.md` §4 (five tables, non-obvious relationships — this module needs the module-level README that single-table Vessels didn't).
- **Create: `src/app/api/attachments/[id]/route.ts`** (or similar) — **new, previously missing from every module's task list (raised in Cursor's review):** every module specifies attachment *upload* validation and `data/attachments/` storage, and `SECURITY_PLAN.md` §6 mandates that attachments be served through an authenticated route rather than a static file mount, but no task anywhere actually defines that serving/download route. Build it once, here, against Certificates' attachments as the reference, since every later module's attachments (Deficiencies, Insurance, Manuals, etc.) serve through the same shape: re-check the session (and role/vessel-scope once RBAC exists), look up the attachment row, stream the file from `data/attachments/` — never resolve the path from anything user-supplied, per `SECURITY_PLAN.md` §6.

**Tool split:** Claude Code builds schema → model → controller → validation → actions → API (backend layer, must exactly match §1's field list and delete-policy annotations) and scaffolds the pages using the canonical pattern (this is "apply a known pattern to a new module," the same repeatable job as Phase 1's Task 10). Cursor takes the scaffolded pages and does the interactive polish — the events timeline UI, the attachment upload dropzone interaction, live-checking against the Certificates mockups referenced in `DESIGN_HANDOFF.md` §8.

- [ ] Add the five tables to `schema.ts` exactly as specified in §1 (including the `(authority, name)` unique index on `certificate_types`, and the RESTRICT/CASCADE annotations per §0.9).
- [ ] Seed `certificate_types` and `issuing_authorities` per §1's Seeding subsection (source: `CERTIFICATES_SPEC.md` §4 plus the client's reminder-rule spec already folded into §1's "Reminder rule model" table) — add a seed step to the migration workflow.
- [ ] Build the backend layer, including the `linkedToDryDock`/`customOffsetDays` precedence logic for effective `offsetDays` (§1: `customOffsetDays` if set → else 180 if `linkedToDryDock` → else the type's `offsetDays`) — this precedence rule gets its own inline comment per `CODE_CONVENTIONS.md` §3, citing §1, since it's exactly the kind of easy-to-quietly-break business rule that standard calls out.
- [ ] Wire `logError` into every catch block in `certificate.controller.ts` (Phase 2.3's convention).
- [ ] Build the API routes with the `{ data }` / `{ error, issues }` envelope and status codes per the Conventions section.
- [ ] Scaffold and then polish the pages; verify the live status badge (from `deriveComplianceStatus`) against §1's 3-state client mapping in all 8 combinations (light/dark × EN/AR × desktop/mobile), same QA discipline as `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 9.
- [ ] Full doc-comment pass (file headers, exported-symbol TSDoc, the module README) per `CODE_CONVENTIONS.md`.
- [ ] Commit in scoped steps (schema → backend → API → UI), not one giant commit.

### Task 5.3: Remaining modules (steps 1, 4–9, 12, 14 — CRUD modules) — repeatable delegation

> **Renumbered (this session, found on a final skim after Round 2):**
> `PROJECT_PLAN.md`'s "Suggested build order" moved Auth to step 0 (it
> used to be step 14, framed as ship-after-everything-else — that framing
> was itself stale and got corrected there). Every step number below it
> shifted down by one as a result. This task's step references are updated
> to match; the module list itself (which modules these are) is unchanged.
>
> **Round 4 correction (after Cursor's review):** the module list below was
> missing **Reminders (step 12, §12)** — it's in the Phase 5 table above,
> but had no owning task anywhere in 5.2/5.3/5.4. It's a plain CRUD module
> with no special dependencies (per `PROJECT_PLAN.md`'s build order:
> "independent of Alerts... but sits naturally next to it in the sidebar"),
> so it belongs here, not in Task 5.4's non-module list. Added below.

Deficiencies, Crew, Insurance, ISM Templates, Manuals, Drawings, Monthly Executed Forms, Reminders, Settings, and Ship Particulars all follow the exact same task shape as Task 5.2, just against their own `PROJECT_PLAN.md` section instead of §1. Rather than writing out full schema/task detail 10 more times here (it already exists, verbatim, in `PROJECT_PLAN.md` §0/§2–§4/§8–§13), this plan hands off each module as:

**Note on scope (corrected — Cursor's review caught that the original version of this task lumped in four items that don't fit this shape at all):** the vessel-detail integration pass (step 10), the Alerts aggregator (step 11), Dashboard (step 13), and Export to Excel/PDF (step 15) are **not** CRUD modules — no new tables of their own (Alerts/Export) or a cross-module presentation pass rather than a module (the integration pass, Dashboard). "Match Certificates file-for-file" doesn't apply to them; see Task 5.4 below for their own task shape instead.

- [ ] For each module, in the build-order sequence from the table above: dispatch one Claude Code subagent (per `dispatching-parallel-agents`/`subagent-driven-development`) given (a) that module's exact `PROJECT_PLAN.md` section, (b) the finished Certificates module (Task 5.2) as the literal pattern to match file-for-file, (c) `CODE_CONVENTIONS.md`, and (d) the Phase 1 design primitives.
- [ ] Cursor takes each scaffolded module for interactive UI polish and visual QA, same division as Task 5.2.
- [ ] Eng.MHD reviews each module's diff before merging — same review gate as `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 10.
- [ ] Respect the dependency column in the build-order table above — don't start Alerts before Deficiencies/Crew/Insurance/Certificates all exist; don't start Monthly Executed Forms before ISM Templates.
- [ ] The Crew module's task additionally includes Phase 4's scrub-PII operation (see Phase 4 above) — don't ship Crew without it, since that's the module GDPR personal-data handling is scoped to. **Also includes `crew_certificate_attachments`** (new this session, `PROJECT_PLAN.md` §3) — passport/visa scans and similar sensitive documents, following `certificate_attachments`' file-upload pattern and `SECURITY_PLAN.md` §6's security procedure (magic-byte validation, UUID storage filenames, authenticated serving route). Scrub-PII must void/remove a member's stored attachments too, not just their text fields.
- [ ] The Settings module's task additionally includes the certificate-type/issuing-authority/system-lists management UI referenced across several earlier modules' "add a new type" links (`DESIGN_HANDOFF.md` §8's Settings row) — build Settings before or alongside whichever module first needs to link to it, not strictly last, despite its §7a build-order position. **Only Users & Roles (§7a) within Settings depends on Auth existing** — System Lists, General, Company Profile, and Form Requirements don't need `users` at all; don't defer the whole Settings module behind Phase 3 — `module-build-order.mermaid` reflects this already (`AUTH --> USERROLES` only, not `AUTH --> SET`; this bullet just restates the reasoning for that edge, not a pending fix).

### Task 5.4: Non-module items — Alerts, Dashboard, the vessel-detail integration pass, Export

These four don't fit Task 5.2/5.3's "match Certificates file-for-file" shape, so each needs its own brief scope statement rather than the generic delegation above:

- [ ] **Alerts aggregator (step 11):** no new tables — `src/modules/alerts/alerts.controller.ts` + `alerts.model.ts` per `PROJECT_PLAN.md` §5's fully-specified `AlertItem`/`getAlerts()` interface, plus `src/app/dashboard/alerts/page.tsx` and the reusable `alerts-list.tsx` component. Depends on Certificates, Crew, Insurance, and Deficiencies all existing (it queries all four). **Tool:** Claude Code for the aggregator query logic (cross-table, must resolve `criticalDays` once per call per §5's own correction note); Cursor for the filtered/sorted feed UI.
- [ ] **Dashboard (step 13):** replaces the placeholder `src/app/dashboard/page.tsx` — no new tables, consumes `getAlerts()` plus lightweight `count()` queries per `PROJECT_PLAN.md` §6's 7-card spec. Depends on Alerts, Monthly Executed Forms, Deficiencies, and Manuals. **Tool:** Cursor-led (this is the most visually composed screen in the app — card grid + multiple preview tables), with Claude Code providing the data-fetching functions it consumes.
- [ ] **Vessel-detail integration pass (step 10):** not a new module — **corrected (Eng.MHD, this session)**: the tab list above (Certificates/Crew/Insurance/Manuals/Drawings/Particulars) was a rough bootstrapping note written before the 10-tab audit landed in `PROJECT_PLAN.md`'s Vessel Profile "Notes" section. The authoritative list, sourced directly from both original client docs' explicit tab enumeration, is **10 tabs, no Crew**: General Info, Certificates, Manuals, ISM Forms, Executed Forms, Drawings, Particulars, Insurance, Deficiencies, Notes. Crew members stay on their own top-level page (filterable by vessel from there), not embedded as a vessel-detail tab. ISM Forms shows the full fleet-wide ISM Templates list unfiltered (confirmed — ISM Templates have no `vesselId`, so there's nothing vessel-specific to filter on). Adds all 10 sections to the existing vessel detail page (`src/app/dashboard/vessels/[id]/page.tsx`) as one consolidated pass, per `PROJECT_PLAN.md` §1's explicit note that this is deferred until Crew and Insurance both ship rather than done per-module. **Tool:** Cursor-led (assembling existing pieces into tabs/sections on one page is exactly the live-layout work Cursor is suited for); Claude Code only if a new cross-module query helper turns out to be needed.
- [ ] **Export to Excel/PDF (step 15):** a shared `exportToExcel(rows, columns)`/`exportToPdf(rows, columns)` utility (`PROJECT_PLAN.md` build-order note), applied first to Certificates and Deficiencies, then rolled out to the rest. No new tables (Certificates/Deficiencies phase), **but a real dependency once it reaches Crew**: per `PROJECT_PLAN.md` §15's new security note, the utility must write an `access_logs` row (`accessType: "export"`) when the source rows are Crew data, and a plain `activity_logs` row (`actionType: "exported"`) for every other module — this means the Crew rollout of Export can't ship before the Phase 4 `access_logs` table exists, a real ordering constraint not previously documented. **Tool:** Claude Code for the shared utility (reused everywhere, so it belongs in the "must be consistent" category); Cursor wires the Export button on each list page to it, one module at a time.

### Task 5.5: Email digest — outbound compliance alerts (step 16, new — added this session)

Full design in `PROJECT_PLAN.md` §12b. Reviewed independently by Cursor before scoping (asked to weigh in on whether it's worth building, digest vs. instant, architecture placement, provider choice, Settings surface, and GDPR/security concerns — findings folded into §12b and this task). **Sequencing decision (Eng.MHD):** real v1 scope, but built after Alerts and Notifications both exist — not parallel Phase 5 work, and appended as step 16 rather than inserted earlier, specifically to avoid another cross-document renumbering pass (see `PLAN_REVIEW.md` Round 3/4 for what that cost last time).

**Files:**
- Modify: `src/db/schema.ts` — add `email_deliveries` (§12b: `id`, `recipientUserId` FK → `users.id` `ON DELETE SET NULL`, `digestDate`, `sentAt`, unique on `(recipientUserId, digestDate)`).
- Create: `src/lib/email/` — a provider adapter (Resend or Postmark; Eng.MHD's choice at Phase 7 provisioning, same category as VPS/DNS decisions, not decided here) behind a thin interface so the provider is swappable without touching the digest logic.
- Create: `src/lib/email/digest.ts` — the scheduled job: reads `getAlerts()` (§5, no new severity logic), resolves recipients via `WHERE users.role = 'Admin'` (a plain column query — **not** gated on Phase 6's blocked tier-permission mapping; the `role` label is populated per-user from Phase 3 onward via Settings > Users & Roles, per §12b's Round 5 clarification), checks `email_deliveries` for an existing `(recipientUserId, today)` row before sending, builds and sends the digest, records the delivery.
- Modify: Settings > General (or a new small card) — add the on/off toggle (§12b: the only v1 Settings field for this feature).
- Create: the digest email template (plain-text/multipart, per §12b — no raw HTML interpolation of vessel/certificate names).
- Modify: Phase 7's `docker-compose.prod.yml`/deployment runbook — needs a cron entry (or equivalent scheduler) to actually trigger the daily job; this doesn't run itself.

**Tool split:** Claude Code for the scheduled job, provider adapter, and template escaping (backend, security-sensitive, must not leak more than §12b specifies); Cursor for the Settings on/off toggle UI (small, matches the existing Settings > General pattern).

- [ ] Add `email_deliveries` to `schema.ts`; migrate.
- [ ] Build the provider adapter behind an interface (e.g. `sendEmail(to, subject, text)`) — Resend/Postmark implementation is an env-configured choice, not hardcoded to one vendor in the calling code.
- [ ] Build the digest job: `getAlerts()` → group by recipient (all Admin-role users) → check `email_deliveries` idempotency → render template → send → record delivery.
- [ ] Wire the cron/scheduler entry in the Phase 7 deployment runbook.
- [ ] Add the Settings on/off toggle; digest job checks it before doing anything.
- [ ] Deep links in the email require an existing session login — no long-lived tokens embedded in the URL (§12b).
- [ ] Log "digest sent to user X, date Y" server-side (the `email_deliveries` row itself satisfies this — no separate log needed).
- [ ] **GDPR artifact (Phase 4-adjacent):** add a line for the email provider as a data processor/subprocessor to the record-of-processing-activities document once that's drafted (Phase 4) — this task doesn't draft that document itself, just flags the dependency.
- [ ] Full doc-comment pass per `CODE_CONVENTIONS.md` — `src/lib/email/` is shared/foundational, no exceptions.
- [ ] Commit in scoped steps (schema → adapter → job → Settings toggle → cron wiring).

---

## Phase 6 — RBAC layer

**Previously blocked; mapping now provided by Eng.MHD (this session).** The
originally-assumed 5-role × 3-tier (Full control / Limited upload / View
only) model is **not** what was actually wanted — the real design is
**binary allow/deny per module**, no "limited" tier. Eng.MHD also confirmed
a real structural detail neither source doc stated explicitly: users split
into two classes, **office-based** (Admin, Superintendent, Read Only —
fleet-wide, no vessel scoping) and **vessel-based** (Management User,
Vessel User — each tied to exactly one vessel). This is provided as a
starting mapping, not a final frozen spec — Eng.MHD will give corrections
and additions as they come up; re-confirm before this phase ships if it's
been a while since the mapping was last touched.

### Schema addition this phase requires

- `users.role` — currently untyped `text("role")` (`src/db/schema.ts`,
  comment: "Phase 6 fills this in and enforces it; until then it is stored
  but unused"). Convert to
  `text("role", { enum: userRoleEnum })` where
  `userRoleEnum = ["admin", "management_user", "superintendent", "vessel_user", "read_only"] as const`.
- `users.vesselId` — **new** nullable FK → `vessels.id`, `ON DELETE
  RESTRICT`. Populated only for `management_user` and `vessel_user` rows;
  null for the three office roles. One vessel per vessel-scoped user (not
  a join table — confirmed as a single-vessel relationship).
- Diagram already updated: `diagrams/erd-full-schema.mermaid`'s `USERS`
  block and the new `VESSELS ||--o{ USERS` edge reflect this.

### Resolved permission table (binary R/W per module)

| Module | Admin | Superintendent | Management User (own vessel only) | Vessel User (own vessel only) | Read Only |
|---|---|---|---|---|---|
| Certificates | R/W | R/W | R | R | R |
| Deficiencies | R/W | R/W | R/W (log & update) | R | R |
| Crew | R/W | R/W | R | R | R |
| Insurance | R/W | R/W *(inferred)* | R | R | R |
| Manuals | R/W | R/W *(inferred)* | R | R | R |
| Drawings | R/W | R/W *(inferred)* | R | R | R |
| ISM Templates (fleet-wide, no vessel scoping applies) | R/W | R/W *(inferred)* | R | R | R |
| Monthly Executed Forms | R/W | R/W *(inferred)* | R/W (submit) | Submit only | R, no upload |
| Ship Particulars | R/W | R/W *(inferred)* | R | R | R |
| Reminders | R/W | R/W *(inferred)* | R *(inferred)* | R *(inferred)* | R |
| Alerts / Notifications / Dashboard | R/W | R *(inferred)* | R *(inferred)* | R *(inferred)* | R |
| Vessel registry (add/remove) | R/W | ✗ | ✗ | ✗ | ✗ |
| Settings — Users & Roles | R/W | ✗ | ✗ | ✗ | ✗ |
| Settings — General / Company Profile / System Lists | R/W | ✗ *(inferred)* | ✗ | ✗ | ✗ |
| Export | Y | Y *(inferred)* | Own-vessel data only *(inferred)* | ✗ *(inferred)* | ✗ |

Cells marked *(inferred)* were not explicitly given by Eng.MHD — they're
extrapolated from the confirmed cells' pattern (office roles get the
compliance modules; vessel roles get narrow, vessel-scoped, mostly-read
access) and should be re-confirmed with Eng.MHD before this phase's build
prompt is finalized, not treated as equally authoritative to the
confirmed cells.

**Confirmed by Eng.MHD (2026-09-17):** all *(inferred)* cells in the table
above accepted as-written — the table is now fully authoritative, no cell
remains provisional. Phase 6 build prompts may proceed against it directly.

Once the mapping is re-confirmed:

- [ ] Add `userRoleEnum` and `users.vesselId` to `schema.ts` per above; migrate.
- [ ] Add a `WRITE_ROLES`-style table/config read by both server-side enforcement and UI gating (per `MASTER_PLAN.md` Phase 6) — binary per-module, not 3-tier.
- [ ] Add a vessel-scoping check alongside the role check for `management_user`/`vessel_user` — every read/write in a vessel-scoped module must also verify the record's `vesselId` matches the caller's `users.vesselId`, not just that the role permits the module. This is a materially bigger check than a flat role gate (row-level, not just action-level).
- [ ] Add role (+ vessel-scope) checks to every Server Action across every module built in Phase 5 — this is a cross-cutting retrofit pass, not a new module, so budget it as touching every `actions.ts` in the repo.
- [ ] Add the RLS policies deferred from Phase 4 now that role/vessel-scoping data exists — RLS shape is now confirmed "role-and-row-based" (`SECURITY_PLAN.md` §4's open question is resolved: vessel-level scoping is a real requirement).
- [ ] Resolve the sidebar-visibility question (`PLAN_REVIEW.md` finding #6) — hide, disable, or visible-but-403 for a nav item the caller's role/vessel-scope can't reach.
- [ ] **Tool:** Claude Code — this is the same "must be consistent across every file" class of work as the Postgres migration, just wider (every module instead of one schema file).

---

## Phase 7 — VPS deployment & hardening runbook

Per `MASTER_PLAN.md` Phase 7's fully-specified runbook (UFW, fail2ban, LUKS, four/five hardened containers, Caddy, `pg_dump`/`pgBackRest` to Backblaze B2, Hetzner sizing). This plan's job is only to split what's automatable from what needs Eng.MHD directly:

- [ ] **Claude Code** authors: `docker-compose.prod.yml` (app + Postgres + Caddy + GlitchTip + Redis/Valkey sidecar, pinned image versions, non-root/read-only/capability-dropped per the runbook), the UFW/fail2ban provisioning script, the backup script (`pg_dump`/`pgBackRest` cron + Backblaze B2 upload).
- [ ] **Eng.MHD directly** (neither tool has the credentials or account access to do this): provisions the Hetzner VPS, sets up the Backblaze B2 bucket, points DNS at the VPS per the two-option domain model in `PROJECT_PLAN.md`'s Cross-cutting notes, and runs the provisioning script against the real server.
- [ ] Trivy (or equivalent) image scanning added to the CI/CD pipeline from Phase 2, gating deploys — Claude Code.
- [ ] **Email digest provisioning (new, Round 5 — Task 5.5's cron dependency, previously unlisted here):** create the Resend/Postmark account (Eng.MHD's provider choice, §12b), verify the sending domain and set its SPF/DKIM/DMARC DNS records (Eng.MHD, alongside the other DNS work above), store the provider API key as an environment secret (Claude Code wires the env plumbing, Eng.MHD supplies the actual key value), and add the digest job's cron entry to `docker-compose.prod.yml`/the scheduler (Claude Code). Sign the provider's DPA before real compliance data goes through it (Eng.MHD, feeds the Phase 4 record-of-processing-activities document).

---

## Phase 8 — Security review

Per `MASTER_PLAN.md` Phase 8's explicit OWASP Top 10 (2025) mapping — ten items, already listed there with which earlier phase covers each. This plan's addition is only the mechanism:

- [ ] Run the `engineering:code-review` skill (or `security-review` if more appropriate at the time) against the full codebase once Phases 3–7 are built, checked against each of the 10 items `MASTER_PLAN.md` Phase 8 already enumerates.
- [ ] **Human sign-off is mandatory before customer go-live** — per `MASTER_PLAN.md`'s own repeated caveat, neither tool can certify GDPR/security compliance; this phase produces findings for Eng.MHD (and, for the GDPR-specific items, a real DPO/lawyer) to act on and sign off, not an autonomous "passed" declaration.

---

## Self-review notes

- **Coverage check:** every `MASTER_PLAN.md` phase (0.5–8) has a corresponding section above; every `PROJECT_PLAN.md` build-order step (0–16, including step 16's Email digest addendum) is in the Phase 5 table. Phase 4's RLS item is intentionally resequenced after Phase 6 in execution order despite its numbering, since it depends on role data that doesn't exist yet — flagged explicitly rather than silently reordered.
- **Placeholder scan:** the one deliberate "don't guess" item is Phase 6's permission mapping — that's a real external blocker (documented as such in the project's own source docs), not a plan gap being papered over.
- **Type/name consistency:** `deriveComplianceStatus`'s signature and the `ComplianceStatus`/`ReminderRule` names used in Task 5.1 match `PROJECT_PLAN.md`'s own spec verbatim (copied from the source, not re-derived), so Task 5.2's Certificates consumer and the later modules in Task 5.3 all import the same names.
- **What this plan deliberately excludes:** the v2 backlog items `PROJECT_PLAN.md`'s "MVP scope cuts" section still lists (PSC inspections real table, full RBAC permission mapping blocked on Phase 6, cron-scheduled monthly checklists, etc.) — those are out of scope by the project's own decision, not an oversight here. **Corrected (Round 5):** this line previously also named Notifications as blocked/deferred alongside RBAC mapping — that was struck from the v2 backlog in Round 2/3 once Auth became step 0 (Notifications isn't blocked or deferred; it's an ordinary build-order item), so it no longer belongs in this sentence.
