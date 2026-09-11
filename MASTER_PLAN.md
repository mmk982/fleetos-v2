# FleetOS — Master Project Plan (v2)

Design → Database → Development → Security, reviewed against current
industry SDLC, OWASP, GDPR, and Next.js/self-hosted-deployment norms (see
References). This revision corrects three real gaps the first draft had —
no CI/CD, no formal requirements phase, and an authentication design that
matched a known Next.js anti-pattern — and tightens the security phases
against sourced checklists instead of general impressions.

This sits above `PROJECT_PLAN.md` (feature/schema plan, resolved) and
`CERTIFICATES_SPEC.md` (real-data-grounded Certificates spec) — it
sequences them into the wider project, it doesn't replace them.

**Locked decisions:** simple login now (custom layered approach, confirmed
— Phase 3), named per-user accounts (confirmed), 5-role RBAC layered on
later; you personally provision/maintain every customer's VPS (Hetzner,
resolved — Phase 7); a proper design pass happens before more feature
modules are built (no existing brand assets — designing here next);
GDPR-level rigor is the security baseline for crew/personal data
regardless of customer jurisdiction (scrub-PII erasure approach
confirmed); self-hosted GlitchTip for error tracking; GitHub for version
control; open-ended timeline; **database engine is PostgreSQL, not
SQLite** (revisited and reversed after the initial draft — reasoning
below and in `PROJECT_PLAN.md`); **this is an MVP, explicitly built to be
extended** (reasoning immediately below). **All 8 previously-open items
are now resolved — see "Open items" at the bottom (Revision note (8)).**

## Product philosophy: MVP built for future extension (new)

Explicit standing note from you: this build is a real MVP, backed by a real
ship management company, going into actual fleet-office use — not a demo.
Expect substantial post-launch iteration once real-life testing surfaces
what staff actually need, and the app's structure needs to absorb that
without a rewrite. Researched what "build an MVP for extension" concretely
means rather than assuming, since over-building for imagined future needs
is its own, opposite failure mode (months spent on multi-tenancy/
microservices/CQRS a small team doesn't need yet). Net guidance: keep a
clean modular monolith, treat tenancy as a deployment-model decision (not
a schema one) when physical per-customer isolation is already the plan,
and put configuration/extension points where real friction is *already
visible* rather than everywhere speculatively.

Applied here as three concrete decisions:

- **Multi-tenant readiness is already solved, not a gap.** The existing
  "one Docker stack per customer" decision (locked above) *is* the
  strongest form of tenant isolation — physical separation, not shared
  tables with a `tenant_id` column and row-level filtering that has to be
  gotten right in every single query forever. If the ship management
  company wants this resold to other ship managers later, that's a new VPS
  + Docker stack per customer, not a schema retrofit. No change needed;
  this was already the right call.
- **Settings becomes a generic key-value table, not fixed columns**
  (`§7a`, `PROJECT_PLAN.md`) — the one place in the current schema that
  *would* need a migration for every small addition post-launch, and
  post-launch is exactly when small settings tend to accumulate fastest
  (notification preferences, export defaults, whatever real usage
  surfaces). Cheap to do now, since the settings table doesn't exist yet;
  expensive to migrate later once real rows and app code depend on fixed
  columns.
- **Basic observability moves into the MVP scope, not a "later" phase**
  (Phase 2 below) — a real company running this operationally needs
  failures to surface in a log/error tracker before a staff member has to
  email you about it. This is infrastructure, not a feature, and cheap to
  wire in during initial setup versus painful to add blind after a real
  production incident with no diagnostic trail.

Deliberately **not** changed: the reference-data seed scope for
`certificate_types`/`issuing_authorities` stays "representative only"
(`§0.11`, `PROJECT_PLAN.md`) rather than front-loading the full ~100+ item
archive — real usage will show which types actually matter faster than
guessing upfront, and Settings CRUD already makes adding the rest
low-friction. Real-life testing is the point of an MVP; this is the one
place "wait and see what real usage needs" is the right call rather than
over-preparing.

## Revision: SQLite → PostgreSQL

The original v1/v2 drafts of this plan (and `PROJECT_PLAN.md`) targeted
SQLite. That's been revisited given this is a real, compliance-focused
product, not a prototype: SQLite has no row-level security (no DB-level
defense-in-depth under the RBAC layer in Phase 6), no native point-in-time
recovery (a real gap for a product where "what did this certificate record
say on this date" is a genuine operational question, not hypothetical), and
retrofitting encryption onto an existing SQLite deployment later is a risky
file-format migration, not a config change. PostgreSQL is now the target
everywhere in this plan and in `PROJECT_PLAN.md`/`CERTIFICATES_SPEC.md`.
One correction to keep precise: **switching database engines doesn't by
itself solve encryption-at-rest** — that's handled at the VPS disk layer
(full-disk encryption, e.g. LUKS) regardless of which database runs on top,
and Phase 4/7 below reflect that rather than implying Postgres encrypts
data automatically. What Postgres specifically adds is RLS, native PITR,
and a much better story if encryption needs change later (disk-level
re-encryption doesn't require migrating the database's file format the way
adding SQLCipher to an existing SQLite file would).

## What changed in this revision, and why

- **Added Phase 0 (Requirements/Discovery).** Standard SDLC guidance puts
  planning and requirements analysis before design, not implied by it. A
  lot of this is already done informally across this conversation and
  `PROJECT_PLAN.md` — this phase formalizes it rather than starting over.
- **Added a CI/CD phase, previously missing entirely.** The original v1
  plan had no build pipeline or staging environment anywhere in it. Current
  guidance for small/solo teams: GitHub Actions, lint+test+deploy, keep
  core CI under ~10 minutes, branch protection, and a staging environment
  before anything reaches a customer's VPS.
- **Corrected the authentication design.** V1 said Next.js middleware would
  protect `/dashboard/*`. That's the specific pattern behind
  **CVE-2025-29927**, a real middleware-authorization-bypass vulnerability
  (an `x-middleware-subrequest` header could skip middleware entirely on
  affected versions). Current guidance is explicit: the edge layer is for
  redirect UX only, never the sole auth check — every Server Action and
  Route Handler must independently verify identity, with the database
  access layer as the final gate. This is also exactly what the original
  app's `CLAUDE.md` already did (`orgDbWithRole()` on every write) — worth
  treating as the model to follow, not just a Postgres-specific detail to
  drop.
- **Terminology correction: `middleware.ts` is `proxy.ts` as of Next.js
  16.** Next.js 16 renamed `middleware.ts`/the `middleware` export to
  `proxy.ts`/`proxy` (a codemod exists: `npx @next/codemod@canary
  middleware-to-proxy`) specifically because "middleware" was getting
  confused with Express-style middleware — the rename makes explicit that
  this file is a network-boundary proxy in front of the app, not a general
  request-handling hook. This app is already on Next.js 16.2.4, so the
  Phase 3 auth layer below should be built as `proxy.ts` from the start,
  never `middleware.ts`. Functionally unchanged from what was already
  planned: it defaults to the Node.js runtime and is meant to stay a thin
  layer (redirects/rewrites), not where real auth logic lives.
- **Replaced the vague security-review phase with an explicit OWASP Top 10
  (2025) mapping**, plus items that weren't in v1 at all: dependency/supply
  chain scanning, security logging & alerting, and concrete Docker/VPS
  hardening controls instead of generic "harden the server."
- **Tightened the GDPR section** with specifics the first draft didn't
  have: 72-hour breach notification, a record of processing activities, and
  an explicit note that GDPR compliance sign-off is a legal determination —
  I can build the technical controls, but whether they add up to actual
  compliance is a question for a lawyer or DPO, not an engineering call.

## Phase order

**Reordering note (researched, not assumed):** general SDLC guidance is
consistent that version control plus a basic CI pipeline should exist
*before* design or feature work resumes, not after — "set up version
control and a basic CI pipeline... before teams begin actual feature
development work." The "validate the idea, design first" pattern common in
2026 indie-hacker guidance doesn't apply here — that advice is for
pre-validation products; this one is a rebuild of an already-shipped,
feature-complete app with real customer data, not an unvalidated idea. Given
this repo specifically still has only one git commit with a full CRUD
module sitting uncommitted (flagged at the very start of this project), the
git-remote-migration part of Phase 2 moves ahead of Design — it protects
existing work and costs little time, versus more work accumulating
uncommitted while Design happens first.

0. **Requirements & discovery** — formalize what's already been decided.
0.5. **Version control foundation (do this first, before Design)** — commit
   everything, push to a remote git host (GitHub), and stand up a minimal
   CI check (lint + typecheck on every push) before any more work — design
   or otherwise — adds to what's currently unprotected.
1. **Design system** — before more UI gets built.
2. **CI/CD & environments** — the fuller pipeline (staging, deploy
   approval) builds out from the Phase 0.5 foundation.
3. **Simple authentication** — defense-in-depth, not middleware-only.
4. **Database security pass** — GDPR controls applied before Crew fills
   with real personal data.
5. **Feature build** — Certificates → Deficiencies → Crew → Insurance →
   Alerts → Dashboard, per `PROJECT_PLAN.md`, with testing built in per
   module rather than deferred to the end.
6. **RBAC layer.**
7. **VPS deployment & hardening runbook.**
8. **Security review** — OWASP Top 10 (2025) pass, plus ongoing supply-chain
   scanning and logging/alerting, before first customer go-live.

---

## 0. Requirements & discovery (Phase 0)

Mostly already done in this conversation — worth writing down explicitly
rather than treating it as implicit: target users (fleet office staff
managing compliance, not end customers), core problem (certificate/crew/
insurance expiry tracking with reliable reminders), deployment model
(single-tenant per VPS, developer-managed), and the feature scope already
locked in `PROJECT_PLAN.md`. **Resolved:** no fixed timeline/deadline for
now — build order stays dependency-driven, as currently sequenced, rather
than date-driven. Revisit if a real go-live date is set with the ship
management company.

## 1. Design system (Phase 1)

Typography, color, spacing, a small component set applied to the shell,
login screen, and Vessels pages as the reference implementation.
**Resolved:** no existing brand assets yet — the design pass happens here
(this conversation) rather than in Cursor, producing something concrete
for Cursor to implement once it exists. Not started yet; next real
substantive step once the open-items list is closed out.

## 2. CI/CD & environments (Phase 2) — new in this revision

- **Pipeline:** GitHub Actions (the current default for small/solo teams —
  minimal setup, generous free tier). Start simple: lint + typecheck + test
  on every push, deploy only on manual approval given the per-customer-VPS
  model. Keep core CI under ~10 minutes or it stops getting checked.
- **Environments:** a staging environment on your own infrastructure (not
  a customer's VPS) that every change goes through before being shipped to
  any real customer instance. Given the per-customer-VPS deployment model,
  "production" is really N separate deployments — staging is where you
  validate a release once before rolling it out, not a single shared prod.
- **Secrets:** production deploy credentials scoped to the deploy job only,
  never available to every workflow run; periodic review of who/what has
  repo secret access.
- **Observability (new — MVP scope, not deferred; see "Product philosophy"
  above):** structured server-side logging (request/error context, not
  just `console.log`) plus a self-hosted-friendly error tracker wired into
  the app before first real customer use. Cheap to set up alongside the
  Docker Compose work already happening in this phase; the alternative is
  finding out something broke because fleet-office staff emailed about it,
  with no trail to diagnose why. **Resolved: GlitchTip, self-hosted** — a
  4th container alongside app/Postgres/Caddy, per customer's Docker
  Compose stack (Phase 7). No error data leaves the customer's own
  infrastructure (a clean fit with the GDPR posture already locked in) and
  no per-seat/monthly SaaS cost as the customer count grows. **Propagated into the code convention, not just infra** (fixed
  after review caught the gap — `PROJECT_PLAN.md` Revision note (7)): the
  `logError(code, context)` seam in `PROJECT_PLAN.md`'s "Conventions"
  section is what every Phase 5 module's controller actually calls into,
  so this infra decision has a real code-level landing spot from the
  first module built, not just error-tracker infrastructure sitting
  unused until someone remembers to wire it in.
- **Resolved: this repo moves to GitHub** — private repo, integrates
  directly with GitHub Actions (already the planned CI/CD tool). Protects
  the currently-uncommitted Vessels work as soon as it happens; this is
  the Phase 0.5 action and doesn't wait for the rest of Phase 2 to be
  built out.
- **New concrete task from the Postgres revision:** the Vessels module is
  already real, working code on SQLite — not just a plan. Migrating it
  (schema, `client.ts`, `drizzle.config.ts`, the `better-sqlite3` →
  `node-postgres` dependency swap) needs to happen here, alongside standing
  up local Postgres via Docker Compose, before Certificates and later
  modules get built on top of it. This is real rework on top of already-
  shipped code, not just a planning-document change — worth doing this
  migration and confirming Vessels still works end-to-end before Phase 5
  (the feature build) resumes.

## 3. Simple authentication (Phase 3) — corrected in this revision

Same core design as v1 (a `users` table with argon2/bcrypt-hashed
passwords, a `sessions` table, httpOnly signed cookie), but enforced at
three layers, not one:

- **Edge (`proxy.ts`, the Next.js 16 rename of `middleware.ts`):** redirect
  unauthenticated requests to `/login` — UX only, never treated as the
  actual security boundary.
- **Every Server Action / Route Handler:** independently verifies the
  session before doing anything, even though the proxy layer already ran.
  Treat each one as a public endpoint that happens to also get an edge
  redirect in front of it.
- **Database access layer:** the final gate — the same pattern the
  original app used (`orgDbWithRole()` on every write), just without the
  multi-tenant scoping this project doesn't need.

Session specifics worth locking in now rather than guessing later: httpOnly
+ signed cookie (never localStorage — the most common Next.js auth
mistake, since anything that can run JS, including an XSS payload, can read
localStorage), a reasonable `maxAge` (24h is standard; consider something
shorter for this app given it holds compliance/PII data), and session-ID
rotation on login. Passkeys are the recommended 2026 default sign-in method
industry-wide, but given the actual users here are fleet office staff, not
technical users, I'd treat that as a future enhancement rather than a v1
requirement — password + rate-limited login is the pragmatic starting
point.

**Resolved:** the layered approach above is confirmed (vs. an auth
library) — no new dependency, matches the original app's already-proven
`orgDbWithRole()`-per-write pattern. **Resolved: named per-user accounts**,
not a shared login — every fleet-office staff member gets their own
login. This is what `activity_logs.userId`, `notifications.userId`, and
every `uploadedBy`/`responsiblePerson`/`authorId` column in `PROJECT_PLAN.md`
already assumed structurally; confirming it now just closes the open
question rather than changing any schema. **(Round 3 note: these are real
`users` FKs from their first migration, not a deferred "becomes a real FK
later" cleanup — Auth is step 0 in the build order, ahead of every column
listed here, so there's no "later" left to describe.)** It's also what makes "who
closed this deficiency" a real, attributable answer once RBAC (Phase 6)
is layered on, not just a system-level log.

## 4. Database security pass (Phase 4)

Same core items as v1 (encrypted backups, access logging, secrets never in
git or in the database), with GDPR specifics now made concrete rather than
gestured at, and updated for Postgres:

- **Encryption at rest:** handled at the VPS disk layer (full-disk
  encryption, e.g. LUKS), not a database-level setting — this is true
  regardless of SQLite vs. Postgres, and belongs in the Phase 7 VPS runbook
  as a baseline, not something to defer.
- **Row-level security (new, Postgres-specific):** RLS policies enforcing
  the vessel-scoping rules from the Phase 6 RBAC layer at the database
  level — a defense-in-depth backstop if application-level checks in a
  Server Action are ever missed. SQLite had no equivalent.
- **Data minimization:** only collect crew personal-data fields the
  Certificates/Crew modules actually need — don't add "might be useful"
  personal fields speculatively.
- **Retention/erasure — confirmed:** the tension flagged in v1
  (RESTRICT-on-delete vs. right-to-erasure) resolves as: block deleting a
  crew row while it's referenced elsewhere, but support a documented
  "scrub PII" operation that nulls out personal fields on request without
  deleting the row or breaking referential integrity. You confirmed this
  approach; still worth a real legal/DPO review before this handles real
  crew data for a real customer, per the caveat below — confirming the
  *technical* mechanism isn't the same as a compliance sign-off.
- **Breach notification:** GDPR requires notifying affected users and the
  relevant supervisory authority within 72 hours of a breach becoming
  known. Worth having a short written incident-response procedure before
  any customer holds real crew data, not improvising one during an actual
  incident.
- **Record of processing activities:** a simple internal document (what
  personal data is collected, why, how long it's kept) — an artifact to
  maintain, not a code feature, but part of actually being compliant.
- **Important caveat:** these are the technical controls GDPR expects
  software to have. Whether they add up to full compliance for your
  business (data processing agreements with customers, lawful basis
  determination, whether a DPO is required) is a legal question — worth a
  real legal/DPO review before you're handling real crew data for a real
  customer, not something I can sign off on as an engineering plan.

## 5. Feature build (Phase 5)

Unchanged sequence from `PROJECT_PLAN.md`. One process change from this
review: functional/integration tests for each module land with that
module (shift-left — quality built into every phase, not checked only at
the end), not deferred to a single testing phase after everything is built.
Vitest scope still starts with `src/lib/expiry` (already decided) and
expands module-by-module as each one ships.

## 6. RBAC layer (Phase 6)

**Updated role names** (per "required in details.docx," now the
authoritative product source, superseding the earlier list drawn from the
old app's docs): **Admin, Management User, Superintendent, Vessel User,
Read Only** — 5 roles, single `WRITE_ROLES` table read by both
server-side enforcement and UI gating. `Management User`'s exact permission
boundary relative to Superintendent isn't defined by the source doc yet —
open item, needs a decision when this phase is actually built (tracked in
`PROJECT_PLAN.md`'s status section). With Postgres, this can be backed by
database-level row-level security policies as well (Phase 4), not just
application-code checks — the same permission model enforced twice, at the
app layer and the DB layer, rather than trusting application code alone.

## 7. VPS deployment & hardening runbook (Phase 7)

Enriched with concrete controls rather than v1's general gesture at
"harden the server":

- **Host:** UFW with default-deny, allowing only 22 (SSH, key-only —
  disable password auth entirely), 80, and 443. Fail2ban for brute-force
  protection. Unattended security updates. **Full-disk encryption (LUKS)**
  as the baseline for encryption-at-rest — engine-agnostic, applies
  regardless of database choice, and belongs here rather than as a
  database-level setting.
- **Containers:** four services now — app, **Postgres**, the reverse
  proxy, and **GlitchTip** (self-hosted error tracking, resolved Phase 2
  above) — up from the original app's three-service
  `docker-compose.prod.yml` shape. Run as non-root, read-only filesystems
  where possible, memory/CPU/PID limits set, capabilities dropped by
  default, `no-new-privileges` enabled, never mount the Docker socket into
  a container. Pin image versions/digests — never `:latest` (this applies
  to the Postgres and GlitchTip images too, e.g. `postgres:17.x`, not
  `postgres:latest`).
- **Images:** scan with Trivy (or equivalent) before every deploy; use
  official/verified base images.
- **Reverse proxy:** Caddy for automatic TLS — minimal config, avoids
  hand-rolling certificate renewal. Matches the original app's
  `docker-compose.prod.yml` (app + Postgres + Caddy) exactly.
- **Backups:** `pg_dump` on an hourly or 4-hourly cadence plus a nightly
  full backup (Postgres dump + `data/attachments/`), shipped off-box,
  encrypted. A concrete starting cadence, not just "automated backups." A
  Postgres-specific upgrade over the old SQLite plan: WAL archiving enables
  genuine point-in-time recovery, not just periodic snapshots, worth
  setting up (e.g. via `pgBackRest`) rather than `pg_dump` alone once this
  phase is actually built.
- **Baseline sizing:** 2–4 vCPU / 4–8GB RAM / NVMe comfortably runs the
  reverse proxy, app container, Postgres, and a backup sidecar for an app
  this size. **GlitchTip fits within this** (researched, not assumed):
  its all-in-one deployment mode runs comfortably in ~512MB RAM and can
  share the existing Postgres instance rather than needing its own, though
  it wants a small Redis/Valkey sidecar (a 5th lightweight container).
  Stay at the higher end of the range (4GB+) given the extra service, but
  no sizing tier change needed.
- **Resolved: VPS provider — Hetzner; backups — Backblaze B2** (researched
  before recommending, sources in the References section below). Hetzner
  is the clear price/performance leader for this exact shape (small
  Docker Compose stacks, 2–8GB RAM tiers), and its EU data centers are a
  natural fit alongside the GDPR posture already locked in — worth noting
  as a bonus, not the deciding factor. For backups, Backblaze B2 over
  Wasabi: B2 has no minimum retention period and no minimum volume, while
  Wasabi enforces a 90-day minimum retention and a 1TB minimum — B2's
  model fits a rotating `pg_dump`/`pgBackRest` backup pattern with
  variable retention better and avoids paying for storage that's already
  been rotated out. Both are S3-compatible, so this is a low-switching-cost
  choice if you'd rather move to a different provider once running for
  real.

## 8. Security review (Phase 8)

Replaces v1's vague "security review" with an explicit pass against the
current **OWASP Top 10 (2025)**, in the order it's actually ranked:

1. **Broken Access Control (#1)** — directly the RBAC/auth layering work
   from Phases 3 and 6; verify every write path, not just UI visibility.
2. **Security Misconfiguration (#2, up from #5)** — covered by Phase 7's
   Docker/VPS specifics; re-verify no default credentials, no debug mode,
   no exposed admin endpoints in production.
3. **Software Supply Chain Failures (#3)** — new category, not in v1 at
   all: `npm audit`/Trivy scanning of dependencies and the build pipeline
   itself, not just application code.
4. **Cryptographic Failures (#4)** — password hashing (argon2/bcrypt), TLS
   everywhere, encrypted backups.
5. **Injection (#5)** — largely mitigated by the existing Drizzle
   (parameterized queries) + Zod (input validation) pattern already used
   throughout; verify it stays consistent as new modules are added.
6. **Insecure Design (#6)** — this whole plan, effectively; re-review it as
   a whole once Phases 0–7 are real.
7. **Identification & Authentication Failures (#7)** — session `maxAge`,
   rotation on login, rate-limited login endpoint.
8. **Data Integrity Failures (#8)** — the FK delete policy locked in
   `PROJECT_PLAN.md` §0.9: RESTRICT for cross-entity references, CASCADE
   for owned-child rows (`*_attachments`, `certificate_events`,
   `manual_revisions`), SET NULL for the two log-userId columns (revised
   from an earlier RESTRICT-everywhere version — `PROJECT_PLAN.md`
   Revision note (4); this reference was stale until now, see Revision
   note (7) below).
9. **Security Logging & Alerting Failures (#9)** — the GDPR access log
   from Phase 4 doubles as a security log, but needs actual alerting (not
   just passive storage) for anomalous access patterns before go-live.
   The Phase 2 observability addition (structured logs + error tracker)
   covers application errors; this item is specifically about *security*
   events (failed logins, permission denials) getting the same treatment,
   not just crashes.
10. **Mishandling of Exceptional Conditions (#10)** — new category: audit
    error handling doesn't leak stack traces/internals to users, and
    failures fail closed (deny access) rather than open.

---

## Open items — all resolved (Revision note (8))

Every item this section used to track has a decision now, recorded inline
in the relevant phase above:

1. ~~Design direction~~ — **resolved:** no existing brand assets; design
   pass happens here, in this conversation, before Cursor implements it
   (Phase 1).
2. ~~Auth mechanism~~ — **resolved:** confirmed, the custom layered
   approach (Phase 3), not an auth library.
3. ~~Named accounts vs. shared login~~ — **resolved:** named per-user
   accounts (Phase 3).
4. ~~PII retention/erasure approach~~ — **resolved:** confirmed, the
   scrub-PII operation (Phase 4) — still subject to real legal/DPO review
   before real customer data, per the standing caveat there.
5. ~~VPS provider/OS and backup storage destination~~ — **resolved:**
   Hetzner + Backblaze B2, researched before recommending (Phase 7,
   sources below).
6. ~~Timeline/deadline~~ — **resolved:** open-ended, no fixed date for now
   (Phase 0).
7. ~~Remote git host~~ — **resolved:** GitHub (Phase 2).
8. ~~Error-tracker choice~~ — **resolved:** GlitchTip, self-hosted (Phase 2).

This plan now has **zero open items** at the master-plan level. The
concrete next actions, in dependency order: **Phase 0.5** (commit
everything, push to GitHub, minimal lint+typecheck CI — protects the
currently-uncommitted Vessels work) and **Phase 1** (the design pass,
next in this conversation). Both are still gated on your explicit
go-ahead, same as every phase before it — a fully-resolved plan is not a
build authorization.

Still a plan, not a build authorization — nothing starts until you say so.

## References

- [7 Phases of the Software Development Life Cycle (2026)](https://contextqa.com/blog/the-7-phases-of-software-development-life-cycle/)
- [OWASP Top Ten Web Application Security Risks](https://owasp.org/www-project-top-ten/)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/en/)
- [GDPR Compliance Checklist & Requirements](https://www.bitsight.com/learn/compliance/gdpr-compliance-checklist)
- [GDPR compliance checklist - GDPR.eu](https://gdpr.eu/checklist/)
- [10 Docker Security Best Practices for Self-Hosters (2026)](https://blog.byte-guard.net/docker-security-best-practices/)
- [Docker Compose Production VPS Architecture For Small SaaS Apps](https://www.dchost.com/blog/en/docker-compose-production-vps-architecture-for-small-saas-apps/)
- [Next.js Security Best Practices: Complete 2026 Guide](https://www.authgear.com/post/nextjs-security-best-practices/)
- [Next.js 16 Server Actions Security: The Auth Check Most Developers Miss](https://dev.to/shubhradev/nextjs-16-server-actions-security-the-auth-check-most-developers-miss-1ei1)
- [Building authentication in Next.js App Router: 2026 guide — WorkOS](https://workos.com/blog/nextjs-app-router-authentication-guide-2026)
- [CI/CD Pipelines for Small Development Teams: A Practical 2026 Guide](https://www.monarch-innovation.com/ci-cd-pipelines-for-small-development-teams)
- [SQLite vs PostgreSQL 2026: Which DB Wins for App Backends?](https://www.kunalganglani.com/blog/sqlite-vs-postgresql-for-apps)
- [SQLite vs Postgres in 2026: most web apps do not actually need Postgres](https://goilerplate.com/blog/sqlite-vs-postgres-indie-saas)
- [Best practices for securing SQLite](https://blackhawk.sh/en/blog/best-practices-for-securing-sqlite/)
- [Multi-Tenant Architecture Strategies 2026 Guide](https://gainhq.com/blog/multi-tenant-architecture/)
- [Building a Multi-Tenant SaaS: The Database Design Nobody Talks About](https://navanathjadhav.medium.com/building-a-multi-tenant-saas-the-database-design-nobody-talks-about-7831b576655f)
- [The developer's guide to SaaS multi-tenant architecture — WorkOS](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture)
- [Best VPS for Self-Hosting in 2026: Honest Comparison](https://selfhostsetup.com/posts/best-vps-for-self-hosting/)
- [10 Best Docker VPS Hosting Services (Jul 2026)](https://hostadvice.com/docker-hosting/docker-vps-hosting/)
- [Backblaze B2 vs Wasabi: Budget Cloud Storage 2026](https://apiscout.dev/guides/backblaze-b2-vs-wasabi-api-2026)
- [Wasabi vs Backblaze B2 vs Akave: 2026 Backup Pricing](https://akave.com/blog/wasabi-vs-backblaze-vs-akave-backup-pricing-2026)
- [GlitchTip — Install documentation (resource requirements)](https://glitchtip.com/documentation/install/)
