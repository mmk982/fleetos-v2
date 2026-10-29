# Plan vs code status review

**Date:** 2026-10-29  
**Branch:** `cursor/rbac-enforcement` @ `10d4394`  
**Method:** Independent read-only verification against the repository. Plan checkboxes were treated as stale until proven.

## Baseline (run at start)

```
git log --oneline -15
# 10d4394 docs: update plans and stub module READMEs to match the code
# … through …
# 1b24245 Add certificate sub-items linking (parentCertificateId)

npx tsc --noEmit          → exit 0
npx eslint .              → exit 0
npx vitest run            → 31 files / 195 tests passed
```

Also run during audit:

```
npx vitest run src/lib/expiry src/lib/auth
# 4 files / 56 tests passed (expiry 31, access 14, permissions 5, cron-auth 6)

docker compose exec -T postgres psql -U fleetos -d fleetos -c "\d access_logs"
# Table public.access_logs present (id, user_id, module_name, record_id, access_type, accessed_at)

(Get-ChildItem drizzle\*.sql).Count → 25
Grep drizzle for ROW LEVEL SECURITY → no matches
```

---

## 1. Totals

| Plan file | Checklist items | DONE | PARTIAL | NOT DONE | SUPERSEDED | CANNOT VERIFY |
|---|---:|---:|---:|---:|---:|---:|
| `MASTER_IMPLEMENTATION_PLAN.md` | 79 (incl. 1 pre-ticked) | 57 | 4 | 8 | 4 | 5 |
| `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` | 50 | 23 | 5 | 11 | 2 | 8 |
| `SECURITY_PLAN.md` | 12 | 2 | 8 | 1 | 0 | 1 |

Notes:

- Process-only bullets (“Commit…”, “dispatch Claude Code…”, “Eng.MHD reviews…”) are classified by whether the **deliverable** exists; tooling/process meta-instructions without a code artifact are **SUPERSEDED** or **CANNOT VERIFY**.
- Exact historical commit messages were not required for DONE when files and behaviour match the item.

---

## 2. Full tables

### 2.1 `MASTER_IMPLEMENTATION_PLAN.md`

| Line | Item (short) | Status | Evidence | Note |
|---:|---|---|---|---|
| 33 | Commit Task 0 docs + vessels retrofit | **DONE** | Files exist: `CODE_CONVENTIONS.md`, `MASTER_IMPLEMENTATION_PLAN.md`, `src/db/schema.ts`, `src/modules/vessels/` | Landed across history, not necessarily one named commit |
| 68 | Stand up Postgres via docker-compose | **DONE** | `docker-compose.yml:12-24` (`5433:5432`) | Local DB was reachable during audit |
| 69 | Schema/driver changes for vessels → Postgres | **DONE** | `drizzle.config.ts` `dialect: "postgresql"`; `schema.ts` `pgTable` | — |
| 70 | vessel.controller async | **DONE** | `vessel.controller.ts:67` `export async function listVessels` | — |
| 71 | db:generate / db:migrate | **DONE** | `package.json:12-13`; `drizzle/` 25 SQL files | — |
| 72 | Manually verify Vessels UI vs Postgres | **CANNOT VERIFY** | No automated DB UI test suite | Prior runtime sessions exercised UI; not re-proven this audit |
| 73 | TSDoc updates client.ts + vessel header | **DONE** | `src/db/client.ts` header describes Postgres/`pg.Pool` | — |
| 74 | RLS groundwork decision in getDb() | **NOT DONE** | `src/db/client.ts:14-15` comment only; no `SET LOCAL` wrapper | Searched `drizzle/**` for RLS: none |
| 75 | Commit SQLite→Postgres message | **DONE** | Postgres is live; migrations applied | Exact commit subject may differ |
| 83 | CI + staging deploy job | **DONE** | `.github/workflows/ci.yml:22-29`; `deploy-staging.yml` `workflow_dispatch` + `environment: staging` | Staging is scaffold (exits 0 if secrets missing) |
| 84 | Document staging secrets | **DONE** | `.env.example:34-40`; `README.md` CI/staging section | — |
| 97 | Write `logError` + GlitchTip | **DONE** | `src/lib/logging.ts:47`, DSN `GLITCHTIP_DSN`/`SENTRY_DSN` | — |
| 98 | Retrofit vessel.controller catch → logError | **DONE** | `vessel.controller.ts` calls `logError` (e.g. ~174) | — |
| 99 | Document logError TSDoc | **DONE** | `logging.ts` file + function TSDoc | — |
| 118 | Read Next proxy docs before writing | **CANNOT VERIFY** | Process step; no durable evidence | `src/proxy.ts` exists (Next 16 style) |
| 119 | users/sessions schema + migrate | **DONE** | `schema.ts` users/sessions; migrations present | — |
| 120 | password.ts argon2 + session.ts cookie | **DONE** | `password.ts`; `session.ts:40-43` idle 8h / absolute 24h | — |
| 121 | proxy.ts → /login | **DONE** | `src/proxy.ts:34` | No `middleware.ts` |
| 122 | Session on every Server Action | **DONE** | Pattern: `requireSession` in module `actions.ts` (e.g. vessels) | Spot-checked; not every file line-audited |
| 123 | login page → loginAction | **DONE** | `src/app/login/page.tsx`; `src/modules/auth/actions.ts` | — |
| 124 | Login rate limit IP + account | **DONE** | `login-rate-limit.ts` 5/acct, 40/IP, 15m | — |
| 125 | Breached-password check | **DONE** | `pwned-password.ts` HIBP k-anonymity | — |
| 126 | Break-glass reset script | **DONE** | `scripts/reset-password.ts`; `docs/RUNBOOK.md` | — |
| 127 | Security headers §8.1 | **DONE** | `next.config.ts` HSTS, CSP, XCTO, Referrer-Policy, Permissions-Policy, COOP | — |
| 128 | Origin/Sec-Fetch-Site on mutations | **DONE** | Already `[x]`; `request-guard.ts` + `rejectCrossOrigin` on APIs | Runtime-verified earlier (403 evil Origin) |
| 129 | Controller-layer role/ownership gate | **DONE** | `assertModuleAccess` / `assertVesselScope` in controllers (certs/vessels/crew…) | Vitest `access.test.ts` 14 tests |
| 130 | Document session/password TSDoc | **DONE** | Headers on `session.ts`, `password.ts` | — |
| 138 | Postgres RLS policies | **NOT DONE** | No RLS in `drizzle/*.sql`; no `SET LOCAL app.user_id` | App-layer vessel scope exists instead |
| 139 | scrubCrewMemberPii (+ certs) | **DONE** | `src/modules/crew/scrub-pii.ts:51+` | Tests: `scrub-pii.test.ts` |
| 140 | access_logs GDPR log | **DONE** | `\d access_logs` OK; writes in crew + attachment resolve + crew export | — |
| 141 | Encryption at rest (LUKS) | **SUPERSEDED** | Item itself: not app code; Phase 7 | No LUKS in repo (expected) |
| 142 | Breach procedure + ROPA docs | **NOT DONE** | Searched `docs/` — no ROPA / breach-notification artifact | Runbook exists but not these |
| 189–192 | Expiry engine tests + impl + TSDoc | **DONE** | `src/lib/expiry/`; vitest 31 tests green | — |
| 193 | Commit (expiry) | **DONE** | Code present in tree | — |
| 209–212 | Certificates schema/seed/backend/logError | **DONE** | `schema.ts` cert tables; `db/seed/certificates.ts`; `effectiveOffsetDays`; controller | Also `parentCertificateId` (later) |
| 213 | Certificates API envelope | **DONE** | `src/app/api/certificates/**` | — |
| 214 | Certificates UI + 8-combo QA | **PARTIAL** | Pages + StatusPill exist | EN/AR × light/dark formal QA: CANNOT VERIFY / not evidenced |
| 215 | Certificates doc-comment + README | **DONE** | `src/modules/certificates/README.md` | — |
| 216 | Commit scoped (certs) | **DONE** | History contains cert commits | — |
| 238–241 | Dispatch/polish/review/deps for modules | **SUPERSEDED** / **CANNOT VERIFY** | Modules exist under `src/modules/*` | Process/tooling; Eng.MHD review not verifiable |
| 242 | Crew + scrub-PII + attachments | **DONE** | Crew module + scrub-pii + crew_certificate_attachments | — |
| 243 | Settings system lists + users | **DONE** | `dashboard/settings/**`; users controller; system-lists | — |
| 249 | Alerts aggregator | **DONE** | `alerts.controller.ts:285` `getAlerts`; `alerts/page.tsx`; `alerts-list.tsx` | — |
| 250 | Dashboard | **DONE** | `src/app/dashboard/page.tsx` uses `getAlerts` | — |
| 251 | Vessel-detail 10 tabs (no Crew) | **PARTIAL** | `vessel-tabs-nav.tsx` tabs: general, certificates, manuals, ism, executed, drawings, particulars, insurance, deficiencies, notes | Matches corrected 10-tab list; panels wired in `[id]/page.tsx` |
| 252 | Export Excel/PDF + crew access_logs | **DONE** | `src/lib/export/index.ts`; `/api/export/*`; crew export uses `accessType: "export"` | — |
| 268 | email_deliveries schema | **DONE** | `schema.ts` + migration | — |
| 269 | sendEmail adapter | **DONE** | `src/lib/email/send.ts` Resend | — |
| 270 | Digest job | **DONE** | `email-digest.controller.ts` `runEmailDigest` | — |
| 271 | Cron in Phase 7 runbook | **PARTIAL** | App route + README curl; no `docker-compose.prod.yml` cron | Prod scheduler still missing |
| 272 | Settings digest toggle | **DONE** | `src/lib/settings/email-digest.ts`; settings actions | — |
| 273 | Deep links need session (no tokens) | **DONE** | Digest builds app URLs only (`email-digest.controller.ts`) | — |
| 274 | email_deliveries logging | **DONE** | Inserts into `email_deliveries` | — |
| 275 | GDPR ROPA line for email provider | **NOT DONE** | No ROPA doc | — |
| 276 | Doc-comment email/ | **DONE** | File headers present | Spot-check |
| 277 | Commit digest | **DONE** | Feature in tree | — |
| 342 | userRoleEnum + users.vesselId | **DONE** | `schema.ts` role enum + vessel_id FK | — |
| 343 | WRITE_ROLES / MODULE_PERMISSIONS | **DONE** | `permissions.ts` `MODULE_PERMISSIONS` | Vitest permissions 5 tests |
| 344 | Vessel-scoping checks | **DONE** | `assertVesselScope` / `requireScopedVesselId` in vessel-scoped controllers | — |
| 345 | Role checks on Server Actions | **DONE** | Actions → controllers with assert* | Spot-checked pattern |
| 346 | RLS policies after Phase 6 | **NOT DONE** | Same as L138 | — |
| 347 | Sidebar visibility decision | **DONE** | `dashboard-sidebar.tsx` hides unauthorized leaves | Product choice: hide (not disable/403) |
| 348 | Tool: Claude Code | **SUPERSEDED** | Process instruction | Not a code deliverable |
| 356 | docker-compose.prod.yml + scripts | **NOT DONE** | `Test-Path docker-compose.prod.yml` → False | Only local `docker-compose.yml` |
| 357 | Eng.MHD Hetzner/B2/DNS | **CANNOT VERIFY** | Needs external accounts | — |
| 358 | Trivy in CI | **NOT DONE** | `.github/workflows/ci.yml` on this lineage still lint/typecheck/test only | Audit high fixed locally; wire CI separately |
| 359 | Email provider provisioning | **CANNOT VERIFY** / **PARTIAL** | Env wiring exists; account/DNS/DPA external | — |
| 367 | Full OWASP skill review Phases 3–7 | **NOT DONE** | No Phase-8 review artifact in repo | Partial earlier reviews ≠ this gate |
| 368 | Human sign-off before go-live | **CANNOT VERIFY** | External | — |

### 2.2 `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md`

| Line | Item (short) | Status | Evidence | Note |
|---:|---|---|---|---|
| 42 | `.gitattributes` LF | **DONE** | `.gitattributes:1-3` | — |
| 51 | Normalize line endings | **CANNOT VERIFY** | Process; LF enforced going forward | Working tree still shows CRLF warnings on Windows |
| 59 | Commit design docs + normalization | **DONE** | Docs present in tree | — |
| 69 | Create working branch | **SUPERSEDED** | Current work on `cursor/rbac-enforcement` | Plan’s original branch name unused |
| 86 | Replace starter tokens w/ HANDOFF palette | **PARTIAL** | `globals.css` tokens exist | Hexes diverge (e.g. accent `#2563eb` vs HANDOFF `#378ADD`; light sidebar white vs `#123A63`) |
| 156 | Verify tokens compile | **DONE** | App builds; tsc/eslint green | — |
| 160 | Commit tokens | **DONE** | In tree | — |
| 179–224 | next-themes + layout + toggle | **DONE** | `theme-provider.tsx`; `layout.tsx`; `theme-toggle.tsx` | — |
| 258 | Verify theme | **CANNOT VERIFY** | Manual 4-combo QA not recorded | — |
| 262 | Commit theme | **DONE** | In tree | — |
| 282 | Identifier primitive | **DONE** | `components/ui/identifier.tsx` | — |
| 295 | Client locale toggle | **NOT DONE** | No locale toggle component | Searched `src/` for locale toggle / next-intl: none |
| 336 | Cookie → dir/lang/font | **NOT DONE** | `layout.tsx` hardcodes `lang="en"` | `preferredLocale` column unwired |
| 362–366 | Verify/commit locale | **NOT DONE** / **CANNOT VERIFY** | Depends on 295/336 | — |
| 385 | Sidebar 5-group | **DONE** | `dashboard-sidebar.tsx` Overview/Fleet/Compliance/Documents/Settings | Named `NAV` not `NAV_GROUPS` |
| 487 | TopBar | **DONE** | `dashboard-top-bar.tsx` | — |
| 537 | Mobile full-screen overlay nav | **PARTIAL** | `mobile-nav-button.tsx` + sidebar overlay | Side panel `w-64`, not full-screen per HANDOFF |
| 586 | Export NAV_GROUPS | **PARTIAL** | Nav exported as `NAV` | Name differs |
| 590 | Wire into dashboard layout | **DONE** | `dashboard/layout.tsx` | — |
| 617 | Verify 4 combinations | **CANNOT VERIFY** | Manual | — |
| 621 | Commit shell | **DONE** | In tree | — |
| 642–789 | StatusPill, ListToolbar, Drawer, Modal | **DONE** | `components/ui/*` | Focus-trap deferred in comments |
| 849 | Commit primitives | **DONE** | In tree | — |
| 865 | Build login screen | **PARTIAL** | `login/page.tsx` tokenized | Defers EN/AR polish in comments |
| 867 | Verify login 4 combos | **CANNOT VERIFY** | Manual | — |
| 869 | Commit login | **DONE** | In tree | — |
| 886–887 | Vessels list + mobile cards | **DONE** | `vessels-list.tsx` ListToolbar/StatusPill/Identifier/mobile cards | — |
| 888 | Verify vessels EN/AR | **CANNOT VERIFY** | Manual | — |
| 889 | Commit vessels list | **DONE** | In tree | — |
| 908–914 | `@drawer` intercepting routes | **NOT DONE** | No `src/app/dashboard/vessels/@drawer` | Add/edit remain full pages |
| 927 | WCAG 8-combo QA | **CANNOT VERIFY** / **NOT DONE** | No audit artifact | HANDOFF notes AA not formalized |
| 928 | No physical ml/mr/pl/pr/left/right | **DONE** | Grep in `src/components`: 0 matches for those prefixes | Residual `text-left`/`text-right` ~36 |
| 929 | File gaps as follow-ups | **PARTIAL** | Some gaps in PLAN_REVIEW; not all filed from Task 9 | — |
| 940 | Skill → DESIGN_HANDOFF | **NOT DONE** | No skill referencing handoff primitives | — |
| 941 | Dispatch module subagents | **SUPERSEDED** | Modules already built | Process |
| 942 | Eng.MHD reviews diffs | **CANNOT VERIFY** | External | — |

### 2.3 `SECURITY_PLAN.md` (Phase 8 checklist, lines 205–216)

| Line | Item | Status | Evidence | Note |
|---:|---|---|---|---|
| 205 | Broken Access Control | **PARTIAL** | Session + `assertModuleAccess`/`assertVesselScope` widespread | No Postgres RLS; IDOR relies on app layer |
| 206 | Security Misconfiguration | **PARTIAL** | Headers in `next.config.ts` | Prod defaults/credentials/debug: **CANNOT VERIFY** without prod |
| 207 | Supply chain (`npm audit`/Trivy) | **PARTIAL** | Local high+ clean on `cursor/deps-security`; residual moderate exceljs/uuid; CI audit/Trivy still absent on this base | See deps-security section |
| 208 | Cryptographic Failures | **PARTIAL** | Argon2id in `password.ts` | TLS/backups: **CANNOT VERIFY** (needs prod/VPS) |
| 209 | Injection | **DONE** | Drizzle builders; Zod on mutations; only `sql` template is singleton check in schema | Grep for raw string SQL interpolation: none found in controllers |
| 210 | Insecure Design (whole-doc review) | **PARTIAL** | This review + prior docs | Formal Phase-8 pass still open |
| 211 | AuthN failures (session + rate limit) | **DONE** | `session.ts` timeouts; `login-rate-limit.ts`; vitest auth suite | — |
| 212 | Data Integrity (FK delete policy) | **PARTIAL** | Schema annotations CASCADE/RESTRICT/SET NULL present | Full spot-check of every FK vs §0.9 not completed line-by-line |
| 213 | Security logging & alerting | **PARTIAL** | `logError` → GlitchTip optional; login rate limit silent to user | No evidenced “5 fails → visible alert” end-to-end |
| 214 | Exceptional conditions fail closed | **PARTIAL** | Auth helpers throw Forbidden; cron fail-closed | Prod stack-trace leakage: **CANNOT VERIFY** without prod `NODE_ENV` |
| 215 | Backup restore drill | **CANNOT VERIFY** | `docs/RUNBOOK.md` still TODO backup procedure | — |
| 216 | Break-glass procedure known | **PARTIAL** | Script + RUNBOOK exist | “Known to more than one person” external |

### 2.4 Other docs (open items, not checkbox totals)

**`PROJECT_PLAN.md` “Status: mostly resolved” (≈2745+):**

| Open item | Code reality |
|---|---|
| ism/reminders/notifications enums proposed | Implemented with proposed values in schema |
| 5-role × 3-tier mapping | **SUPERSEDED** by MIP Phase 6 binary R/W matrix (`permissions.ts`) |
| activity_logs | **DONE** |
| quarterly/yearly due-month logic | Still soft; monthly-forms code exists — confirm against controller |
| System list seed values | Seeds exist for some lists; exact counts vs mockup unverified |
| vessel_notes proposed | **DONE** table + Notes tab |

**`PLAN_REVIEW.md` / `DESIGN_HANDOFF.md`:** open concerns still accurate for locale persistence, `@drawer`, WCAG formal audit, tablet band, Settings Reports gap.

---

## 3. Top 10 real gaps (risk order)

| # | Gap | Status | Smallest next action |
|---:|---|---|---|
| 1 | Postgres **RLS** + per-request `SET LOCAL` wrapper | NOT DONE | Decide: implement RLS wrapper in `getDb()` **or** formally document “app-layer only” and close MIP L74/L138/L346 |
| 2 | **Production stack** (`docker-compose.prod.yml`, UFW, backups, LUKS) | NOT DONE | Author prod compose + backup script stubs; Eng.MHD provisions VPS |
| 3 | **Backup restore drill** + RUNBOOK backup TODO | CANNOT VERIFY / NOT DONE | Define backup procedure; run one restore on staging |
| 4 | **Trivy / npm audit** gate in CI | **PARTIAL** (2026-10-29 `cursor/deps-security`) | Local high+ audit **exit 0** (`next@16.4.3`, `zod@4.6.6`); residual moderate `exceljs→uuid`. **CI still missing** audit/Trivy on `rls-phase1` lineage — merge/add from prod-stack or add here |
| 5 | **GDPR ROPA + breach notification** written artifacts | NOT DONE | Draft short docs under `docs/` before real crew PII |
| 6 | Email digest **prod cron** + provider account/DPA | PARTIAL | Add cron to prod runbook; Eng.MHD creates Resend/Postmark |
| 7 | **Locale / RTL** (`dir`/`lang`, toggle, persistence) | NOT DONE | Wire `preferredLocale` or cookie → `layout.tsx`; add toggle |
| 8 | Vessels **`@drawer` intercepting routes** | NOT DONE | Implement `@drawer` **or** mark plan SUPERSEDED in favour of full-page forms |
| 9 | Formal **WCAG / 8-combo visual QA** record | CANNOT VERIFY | Run Task 9 checklist; store results |
| 10 | Phase 8 **OWASP skill review + human sign-off** | NOT DONE / CANNOT VERIFY | Schedule security-review skill pass before go-live |

---

## 4. Doc/code contradictions

| Plan says | Code does | Which looks authoritative |
|---|---|---|
| DESIGN_HANDOFF accent `#378ADD`, navy sidebar `#123A63` | `globals.css` blue `#2563eb`, light sidebar white | Code shipping; handoff palette stale **or** tokens incomplete |
| DESIGN_HANDOFF Arabic IBM Plex Sans Arabic | Tajawal in `layout.tsx` / `globals.css` | Code |
| DESIGN plan `NAV_GROUPS` export name | `NAV` in sidebar | Code |
| DESIGN full-screen mobile nav | Side drawer `w-64` | Code |
| DESIGN `@drawer` for vessels add/edit | Full pages `vessels/new`, `vessels/[id]/edit` | Code (plan unfinished) |
| PROJECT_PLAN 5×3 tier RBAC | Binary MODULE_PERMISSIONS (MIP Phase 6) | **MIP/code** (PROJECT_PLAN status section outdated) |
| MIP “only vessels table today” (Task 2.1 prose) | Full multi-module schema | Prose historical; ignore |
| Prompt/repo fact “24 migrations” | **25** `drizzle/*.sql` files (0000–0024) | Count files |
| Sidebar always show 5 groups | RBAC **hides** unauthorized items | Code chose hide (MIP L347) |
| next-intl path i18n (older plans) | No next-intl; cookie model planned | **SUPERSEDED** (`PLAN_REVIEW.md`) |

---

## 5. What could not be checked

- Production VPS, TLS termination, LUKS, fail2ban, real backup restore.
- GitHub Environment secrets actually configured for staging.
- Whether Eng.MHD completed human review gates / DPA / multi-person break-glass knowledge.
- Formal light/dark × EN/AR × desktop/mobile QA matrices.
- Full line-by-line FK ON DELETE audit vs PROJECT_PLAN §0.9 for every table.
- Live GlitchTip alerting path with a forced login lockout visible in an ops channel.
- Service worker / PWA: **not present** on `cursor/rls-phase1` / `cursor/deps-security` (no `@serwist/next`); N/A for SW generation check.

---

## Dependency security upgrade (`cursor/deps-security`) — 2026-10-29

Branch from `cursor/rls-phase1`. **No commit/push.**

### Before → after (`npm audit --omit=dev`)

| | Before | After |
|---|---|---|
| Totals | 10 (3 mod, 6 high, 1 critical) | 2 moderate only (`exceljs`→`uuid`) |
| `--audit-level=high` | exit 1 | **exit 0** |

### Direct pins

- `next` / `eslint-config-next`: `16.2.4` → `16.4.3` (exact)
- `zod`: `^4.4.3` → `4.6.6` (exact)

### Notable transitive (no major bumps)

`@next/*` 16.2.4→16.4.3; `postcss` 8.5.10→8.5.23; `sharp` 0.34.5→0.35.5; `nanoid` 3.3.11→3.3.20; `source-map-js` 1.2.1→1.2.2; `brace-expansion` 1.1.14→1.1.21; `baseline-browser-mapping` 2.10.21→2.11.34

### Residual

- `uuid@8.3.2` via `exceljs@4.4.0` (moderate GHSA-w5hq-g745-h8pq). Plan: wait for exceljs release that bumps uuid; **do not** `npm audit fix --force` (would install exceljs@3.4.0).

### Verify

tsc / eslint / vitest 211 / integration 14 / db:check / `next build --webpack` — all exit 0. Browser smoke admin1 + vuA OK under `next start` with `DATABASE_URL=fleetos_app`. Unauth prefetch matrix: no protected data before or after (AFTER also redirects `/dashboard*.rsc` → `/login`).

---

## Module inventory (supporting evidence)

Controllers present under `src/modules/`: activity-log, alerts, audits, certificates, crew (+ crew-certificate), deficiencies, drawings, email-digest, insurance, ism-templates, manuals, monthly-forms (+ requirements), notifications, psc, reminders, settings (users, company-profile), ship-particulars (+ vessel-notes), vessels. Auth has actions only.

Dashboard routes exist for: alerts, audits, certificates, crew, deficiencies, drawings, insurance, ism-templates, manuals, monthly-forms, notifications, particulars, psc, reminders, settings, vessels.
