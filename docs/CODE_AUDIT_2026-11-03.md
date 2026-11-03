# Code audit — 2026-11-03 (Phase 1: report only)

**Branch:** `cursor/code-audit` @ `5c8e3b7` (from `cursor/rls-vessels`)  
**Scope:** bugs, duplication, dead code, consistency, tests  
**Method:** source reading + `jscpd` / `ts-prune` / verify commands. No source fixes in this phase.

## 1. Executive summary

| Severity | Count |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 4 |
| MEDIUM | 19 |
| LOW | 15 |

Highest-priority now: (1) nested `db.transaction()` inside `withDb` can `COMMIT` the outer RLS transaction early; (2) ISM template delete unlinks files before a RESTRICT FK delete; (3) Admin UI password policy skips `assertPasswordAllowed`; (4) DELETE API Conflict→409 inconsistency.

No empty `catch {}` in `src`. No `dangerouslySetInnerHTML`. No `navigator.onLine`. No `.skip`/`.only`/`todo` in tests. No `TODO`/`FIXME`/`HACK`/`XXX` in `src/**/*.ts(x)`. No `console.log`/`debugger` in `src`. Certificate list/alerts use derived compliance, not stored `cachedStatus`. Arabic/RTL kept (not flagged as dead). Server Actions/API mutations: no missing same-origin/session guards found across 17 action files and 55 routes ([Authz audit](05fde8ea-0f24-40c5-9eda-41ef4188e1b7)).

Cross-checked: [Audit duplication helpers](c9d4a549-00fa-4c20-9aaf-cccfcb2bb791) (dupes/tests); [Authz audit](05fde8ea-0f24-40c5-9eda-41ef4188e1b7) (guards, transactions, attachments, auth).

---

## 2. Findings

### A — Correctness / security

| ID | Location | Evidence | Severity | Confidence | Proposed fix | Effort | Regression risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-01 | `src/modules/settings/users.controller.ts:98-99`, `:234-236`; `users-actions.ts:36` (`password: z.string().min(8)`); contrast `src/lib/auth/pwned-password.ts:60-68` + `scripts/create-user.ts` / `reset-password.ts` | Admin create/change password allows length ≥8 and never calls `assertPasswordAllowed`. Scripts and SECURITY_PLAN require ≥12 + HIBP. Grep: `assertPasswordAllowed` only used from scripts, not UI path. | HIGH | CONFIRMED | Call `assertPasswordAllowed` before `hashPassword` in `createUser` / `changeUserPassword`; align Zod to `.min(12)`. | S | low |
| A-02 | DELETE handlers e.g. `src/app/api/certificates/[id]/route.ts:76-96`, `insurance/[id]/route.ts:75-95`, `vessel-particulars/[id]/route.ts:75-95`, `manuals/[id]/route.ts:72-92`, `deficiencies/[id]/route.ts:76-96` vs `crew/[id]/route.ts:94-96` and `vessels/[id]/route.ts:99-100` | PATCH often maps `*ConflictError` → 409; DELETE often only maps Forbidden/NotFound then `throw` → 500. Crew + vessels DELETE correctly map 409 when FK RESTRICT fires (`deleteCrewMember` / `deleteVessel`). | HIGH | CONFIRMED (pattern); MEDIUM impact where delete cannot throw Conflict today | Audit each `delete*` for Conflict throws; map Conflict → 409 on every DELETE like crew/vessels. | M | low |
| A-03 | `src/modules/notifications/actions.ts:32-36` + `notifications.controller.ts:338-358` | `markAllReadAction(userId)` takes client-supplied id; controller calls `assertOwnUser` so cross-user mark-all is denied. | MEDIUM | CONFIRMED | Drop client `userId`; always use `access.userId` so callers cannot pass another id. | S | low |
| A-04 | `src/modules/settings/users.controller.ts` create/update/password/active use plain `getDb()` (not `withDb`) | `users` table is out of RLS scope (docs/RLS.md). `listUsers` is wrapped for vessels join. Mutates do not SELECT `vessels`. | LOW | CONFIRMED intentional | Optional: wrap mutates in `withDb` for consistency only; no RLS requirement. | S | low |
| A-05 | `src/app/api/company-profile/logo/route.ts:13-33` | Unauthenticated logo stream; path only from DB; bare `catch` → 404. | LOW | CONFIRMED intentional (login branding) | Keep; optionally log unexpected errors with `logError` without leaking. | S | low |
| A-06 | `src/app/dashboard/page.tsx:90-112` `Promise.all([...])` | Parallel controller calls each open their own `withDb` transaction (separate pool clients). Not concurrent queries on one shared ALS client. | none / note | CONFIRMED fine | No change. Documented constraint is intra-`withDb` concurrency. | — | — |
| A-07 | Certificate status display | Lists/alerts use `deriveComplianceStatus` / `row.compliance.status` (`certificate.shared.ts:296-311`, `alerts.controller.ts:117-138`, UI `StatusPill status={row.compliance.status}`). `cachedStatus` is write-side cache only. | none / note | CONFIRMED fine | — | — | — |
| A-08 | Same-origin on mutations | Sampled all 16 `actions.ts` + `users-actions.ts`: `assertSameOriginMutation` present. API mutating routes use `rejectCrossOrigin`. Export GETs session-only (OK). Cron: bearer `CRON_SECRET`. | none / note | CONFIRMED (sampled; not every line of every route body) | — | — | — |
| A-09 | Empty catch / swallowed errors in `src` | Grep `catch {}` / `catch () {}`: none found. Logo route uses `catch { return 404 }` with intentional generic body. | LOW | CONFIRMED | Optional structured log on logo failure. | S | low |
| A-10 | Type escapes | `eslint-disable`: 8 (3× next/no-img; 5× test drizzle `any`). Production `as any`/` : any`: **0**. Test `any`: 5. `as unknown as`: 3 (`db/client.ts` drizzle cast; 2 tests). | LOW | CONFIRMED | Leave img disables; prefer typed tx mocks over `any` in tests when touching those files. | S | low |
| A-11 | Nested `db.transaction()` inside `withDb`: `certificate.mutations.ts:56,151`; also `manual.controller.ts:281,362,494`, `monthlyForm.controller.ts:467`, `particulars.controller.ts:401,473`, `crew/scrub-pii.ts:94` | `withDb` already `BEGIN`s on a `PoolClient` (`client.ts:190-194`). Drizzle `NodePgSession.transaction` on a non-Pool client runs `begin` then **`commit`** (`drizzle-orm/node-postgres/session.js:180-191`), ending the outer txn and clearing transaction-local `set_config` RLS vars for later statements (e.g. `refreshCachedStatus` at `:89`). | HIGH | CONFIRMED (code + Drizzle source) | Use outer `tx` only, or `withSavepoint` / avoid nested `db.transaction` on the ALS client | M | med |
| A-12 | `ismTemplate.controller.ts:404-410` delete | Unlinks attachment files, then `DELETE` template. `monthly_form_requirements` / `monthly_executed_forms` reference templates with `onDelete: "restrict"` (`schema.ts:1416-1460`). No `isPgForeignKeyViolation` → Conflict mapping. | HIGH | CONFIRMED | Map 23503 → conflict; delete DB row first (or in txn), unlink files only after commit | M | med |
| A-13 | Files-before-row deletes | Same unlink-then-delete order: certificates `:331`, crew-certs, deficiencies `:789`, particulars `:547`, drawings `:464`, insurance `:359`, monthly-forms `:552`, manuals `:574` | MEDIUM | CONFIRMED | Collect paths → delete rows → unlink after successful commit | M | med |
| A-14 | `logError` + Drizzle | `drizzle-orm/errors.js` embeds query + params in `message`; `logging.ts:65-80` logs `thrown.message` and sends exception to Sentry | MEDIUM | CONFIRMED (mechanism) | Log SQLSTATE/constraint only; strip Drizzle query/params before Sentry | S | low |
| A-15 | `attachments/[id]/route.ts` + `stream.ts:44` | `createReadStream` without pre-stat; response may already be 200 when ENOENT fires async | MEDIUM | LIKELY | `stat`/`access` before streaming; 404 if missing | S | low |
| A-16 | GET API handlers (e.g. `vessels/route.ts`, `vessels/[id]`) | Mutations map `ForbiddenError`; many GETs have no try/catch → module/RLS denial can surface as 500 | MEDIUM | CONFIRMED (vessels); LIKELY elsewhere | Wrap GETs with same Forbidden/NotFound mapping | M | low |
| A-17 | `monthly-form-status.ts:26` `new Date(year, month, 0)` | Local-timezone last day of month vs callers passing `businessNow()` (UTC midnight) | MEDIUM | LIKELY | Use `Date.UTC` for last-day construction | S | low |
| A-18 | `users.controller.ts` `changeUserPassword` (~248) | Password hash updated; existing sessions not destroyed | MEDIUM | LIKELY | Invalidate sessions for that user on password change | S | low |
| A-19 | `updateUser` / `setUserActive` | No last-admin or self-demote/self-deactivate beyond “cannot deactivate self” | MEDIUM | LIKELY | Block demoting/deactivating the last remaining admin | S | low |
| A-20 | Route params as UUIDs | `isPgInvalidTextRepresentation` exists but unused in routes → 22P02 → 500 | LOW | LIKELY | Zod uuid on params or map 22P02 → 404 | S | low |
| A-21 | `removeStoredAttachmentFile` (`stream.ts:56-58`) | Swallows all unlink errors, not only ENOENT | LOW | CONFIRMED | Ignore ENOENT only; log others | S | low |
| A-22 | Login email | Admin creates lowercased email; login schema only trims → case mismatch login failure | LOW | LIKELY | Lowercase in `loginSchema` | S | low |
| A-23 | Attachment MIME | Controllers trust `file.type` (client); no magic-byte check | LOW | CONFIRMED | Shared signature sniff; still serve by extension + nosniff | M | low |
| A-24 | Email digest cron | No `primeBusinessTimezone()`; falls back to UTC until a session primes cache | LOW | LIKELY | Prime timezone at start of cron handler | S | low |

### B — Duplicated code

**Tool:** `npx --yes jscpd --min-lines 8 --min-tokens 70 --reporters console,json --output %TEMP%/fleetos-jscpd src tests scripts`  
**Result:** 377 clones; ~11% duplicated lines (tsx ~10%, ts ~12%). Report deleted after capture.

| ID | Cluster | Copies / similarity | Worth extracting? | Severity | Confidence | Fix | Effort | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-01 | Attachment API POST bodies: `drawings/[id]/attachments`, `insurance/...`, `ism-templates/...`, `vessel-particulars/...`, `monthly-forms/...` (~26–35 lines each) | Near-identical session + cross-origin + FormData + controller call | **Yes** — shared `handleAttachmentUpload` helper would cut drift | MEDIUM | CONFIRMED (jscpd + spot read) | Extract small helper used by attachment routes | M | med |
| B-02 | `drawing-form.tsx` ↔ `manual-form.tsx` (~46 lines); also insurance overlap | Near-identical layout/fields | **Maybe** — shared `VesselScopedEntityForm` shell; fields differ | MEDIUM | CONFIRMED | Only if a third form needs the same shell | M | med |
| B-03 | `audit-form.tsx` ↔ `psc-inspection-form.tsx` (~41 lines) | Near-identical | **Yes** — same domain shape | MEDIUM | CONFIRMED | Shared inspection form with type prop | M | med |
| B-04 | `manual.controller.ts` ↔ `monthlyForm.controller.ts` attachment/delete file loops (~50 lines) | Same shape | **Yes** — already have stream helpers; extend for “delete children then parent” | MEDIUM | CONFIRMED | Shared `deleteRowWithAttachments` pattern | M | med |
| B-05 | Module `actions.ts` helpers: `isNextRedirect`, `readFormString`, `fieldErrorsFromZod`, `*ActionState` (~14 modules; Zod field builders already in `src/lib/validation/form-fields.ts`) | Near-identical boundary helpers; domain field maps differ | **Yes (thin helpers only)** — extract to e.g. `src/lib/actions/form-action.ts`; do **not** build a generic CRUD action framework | MEDIUM | CONFIRMED | Shared action-boundary helpers; keep per-module schemas/controllers | M | med |
| B-08 | Collection API `route.ts` GET/POST (certificates, insurance, drawings, crew, …) | Near-identical session/401/JSON/Conflict map | **Yes (thin)** — `requireApiSession`, `parseJsonBody`, shared 4xx mapper | MEDIUM | CONFIRMED | Small `src/lib/api/route-helpers.ts` | M | med |
| B-09 | Form shell CSS/`useActionState` error banner (certificate/insurance/drawing/crew forms) | Shared `labelClass`/`inputClass`/`errorText` + vessel select | **Yes (partial)** — `FormField` + `FormErrorBanner` primitives; not one mega-form | MEDIUM | CONFIRMED | Extract UI primitives only | M | med |
| B-06 | `permissions.test.ts` ↔ `permissions.ts` matrix (~77 lines) | Test mirrors source | **No** — intentional | none | CONFIRMED | — | — | — |
| B-07 | Integration RLS harness ctx/beforeAll clones across phase1/2/vessels | Near-identical | **Yes** — tiny shared `rlsTestCtx` | LOW | CONFIRMED | Extract test helper | S | low |

### C — Dead / unused

| ID | Item | Evidence | Real / FP | Severity | Confidence | Fix | Effort | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 | `knip` | `npx --yes knip` → `RangeError: Array buffer allocation failed` (oxc-parser) | Tool failed | — | CONFIRMED | Re-run knip with more memory or pin older knip in Phase 2 tool pass (no package.json change in Phase 1) | S | — |
| C-02 | `ts-prune` | Large list of Next `default`/`metadata`/`dynamic`, type-only exports, and used symbols mis-flagged (`exportToExcel`, `alertKindLabel`, `trustedProxyHops` verified used) | Mostly FP | LOW | CONFIRMED for FPs | Manual triage only; do not delete Next entrypoints | M | high if naïve |
| C-03 | i18n `messages/en.json` / `ar.json` | Files **absent**; no `next-intl` / `useTranslations` in src. Locale column exists on users; UI largely English strings + `dir="auto"`. | N/A (no message catalogs yet) | LOW | CONFIRMED | Do not invent catalogs; Arabic/RTL remains via layout/CSS logical props | — | — |
| C-04 | `console.log` / `debugger` in `src` | Grep: none. Related: `console.error` in `lib/logging.ts`, cron digest, dashboard `error.tsx`; `console.warn` in request-guard; `console.info` in notifications sync | none found (log/debug) | — | CONFIRMED | Keep structured logging; no cleanup needed | — | — |
| C-05 | TODO/FIXME/HACK/XXX in `src/**/*.ts(x)` | Grep: none | none found | — | CONFIRMED | — | — | — |
| C-06 | `src/modules/crew/README.md:15` | Text references a TODO for export until §15 reaches Crew | LOW | CONFIRMED | Refresh README when export/crew docs are next touched | S | low |

### D — Consistency / drift

| ID | Issue | Evidence | Severity | Confidence | Fix | Effort | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D-01 | Password policy drift | UI/Zod/controller: 8 chars; `assertPasswordAllowed`/scripts/SECURITY_PLAN: 12 + HIBP (same as A-01) | HIGH | CONFIRMED | Unify on `assertPasswordAllowed` | S | low |
| D-02 | Line endings policy | `.gitattributes`: `* text=auto eol=lf`; `.editorconfig`: `end_of_line = lf`. Policy exists and is correct. Residual CRLF warnings = unclean local autocrlf history, not missing policy. | LOW | CONFIRMED | `git add --renormalize .` in a dedicated chore PR if tree still noisy | S | low |
| D-03 | File size vs coding-style “800 max” | Top: `schema.ts` 1716; `deficiency.controller.ts` 995; `vessels/[id]/page.tsx` 878; `particulars.controller.ts` 760; `monthlyForm.controller.ts` 691 | MEDIUM | CONFIRMED | Split controllers/pages when next feature touches them (not drive-by) | L | med |
| D-04 | Role naming | DB/session: `vessel_user`; TS: `vesselUser` in fixtures only — enum is snake in schema. Consistent enough. | none | CONFIRMED | — | — | — |
| D-05 | DELETE Conflict mapping inconsistency | Same as A-02 | MEDIUM | CONFIRMED | Standardise route catch blocks | M | low |

### E — Tests

| ID | Issue | Evidence | Severity | Confidence | Fix | Effort | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-01 | Controllers without matching `*.controller.test.ts` | Missing: `activity-log`, `alerts` (model test only), `audits`, `crew/crew.controller`, `crew/crew-certificate.controller` (only `scrub-pii.test.ts`), `deficiencies` (only status-filter test), `email-digest`, `psc`, `settings/company-profile`, `settings/users`. Have matching tests (12): certificates, drawings, insurance, ism-templates, manuals, monthly-forms ×2, notifications, reminders, particulars, vessel-notes, vessels | MEDIUM | CONFIRMED | Add access/scope unit tests (crew + crew-certificate, deficiencies, audits, psc first) | M | low |
| E-02 | No `.skip` / `.only` / `todo` | Grep over tests: none | none found | CONFIRMED | — | — | — |
| E-03 | Password policy untested on UI path | No test that createUser rejects short/breached passwords | MEDIUM | CONFIRMED | Unit test controller after A-01 fix | S | low |
| E-04 | API DELETE 409 paths | Crew/vessels have controller mapping; few/no route-level tests for 409 | LOW | LIKELY | Add route or integration case for RESTRICT delete | S | low |
| E-05 | Covered well | Certificate engine (`expiry.test`), RLS phase1/2/vessels (71 integration), login rate limit unit+integration, attachments resolve patterns, many module controller tests | note | CONFIRMED | Keep | — | — |

---

## 3. Quantify

| Area | Files (ts/tsx) | Lines |
| --- | ---: | ---: |
| `src/modules` | 103 | 21510 |
| `src/components` | 89 | 12991 |
| `src/app` | 115 | 10481 |
| `src/lib` | 47 | 5296 |
| `tests` | 8 | 2909 |

**Top 10 largest files**

1. `src/db/schema.ts` — 1716  
2. `src/modules/deficiencies/deficiency.controller.ts` — 995  
3. `src/app/dashboard/vessels/[id]/page.tsx` — 878  
4. `tests/integration/harness.ts` — 787  
5. `src/modules/ship-particulars/particulars.controller.ts` — 760  
6. `src/modules/monthly-forms/monthlyForm.controller.ts` — 691  
7. `src/modules/drawings/drawing.controller.ts` — 663  
8. `src/modules/manuals/manual.controller.ts` — 635  
9. `src/components/system-lists-hub.tsx` — 621  
10. `src/modules/crew/crew-certificate.controller.ts` — 616  

**Other counts:** eslint-disable **8**; production `any` **0**; test `any` **5**; `as unknown as` **3**.

**Verify commands (Phase 1)**

```
git log --oneline -3
5c8e3b7 docs: record decision to keep Arabic/RTL support
064e276 feat(rls): row level security for vessels (migration 0030)
cff0b13 docs: session notes 2026-11-02

npx tsc --noEmit          → exit 0 (no errors)
npx eslint .              → exit 0 (no warnings printed)
npx vitest run            → 43 files, 332 tests passed
npm run test:integration  → 6 files, 71 tests passed
npm run db:check          → Everything's fine
npm audit --omit=dev --audit-level=high → exit 0 (8 moderate via exceljs/minimatch; no high)
```

---

## 4. Fix plan (for Phase 2 — do not apply in Phase 1)

| Batch | Findings | Order rationale | Tests that prove safety |
| --- | --- | --- | --- |
| 1 | A-11 | Nested txn breaks RLS session vars — correctness | Certificate create/update unit + integration; manual/particulars set-current |
| 2 | A-12, A-13, A-02, D-05, E-04 | Delete order + Conflict→409 | ISM delete with requirement attached; crew/vessel RESTRICT; attachment download after failed delete |
| 3 | A-01, D-01, E-03, A-18, A-19 | Password policy + session/admin guards | users.controller unit tests |
| 4 | A-14, A-15, A-16, A-17 | Logs, streams, GET 403, monthly TZ | logging unit; attachment 404; vessels GET forbidden; monthly-form-status unit |
| 5 | A-03 | Small authz hygiene | notifications.controller.test |
| 6 | E-01 (crew, crew-certificate, deficiencies, audits, psc) | Coverage gaps | New unit tests only |
| 7 | B-01 + B-08 | API thin helpers | Existing controller tests + route smoke |
| 8 | B-05 + B-09 | Action/form primitives | Unit + existing action flows |
| 9 | B-03, B-07, A-09–A-10, A-20–A-24, C-06, D-02 | Low-risk cleanup | lint + unit |
| 10 | B-02/B-04/D-03 | Larger refactors with feature work | Module tests + integration |

Skip naïve mass-deletion from ts-prune/knip until C-01 is re-run successfully.

---

## 5. Looked at and found fine

- Server Actions (17 files): no missing `assertSameOriginMutation` / session / Zod guards.  
- API mutations (40/41): `rejectCrossOrigin` present; cron uses bearer secret.  
- RLS tables: controllers use `withDb`/`withSystemDb`; plain pool only for documented non-RLS tables (incl. ISM templates).  
- No `Promise.all` **inside** a single `withDb` callback.  
- Certificate compliance: engine on read path; `cachedStatus` write-side only.  
- Attachment path traversal: DB paths + escape rejection + size/MIME allowlist.  
- No open redirects from query params; no `dangerouslySetInnerHTML`.  
- Cron digest auth via `isValidCronAuth`.  
- Line-ending policy files present and consistent.  
- Arabic/RTL: retained by product decision — not dead.

---

## 6. Limits / CANNOT VERIFY

- **knip** failed (OOM in oxc-parser) — unused dependency report incomplete.  
- **ts-prune** noisy with Next/App Router conventions — not used as delete list.  
- Nested-txn (A-11) confirmed via Drizzle source read; not yet reproduced with a live RLS probe in this phase.  
- React hooks/stale closures: not exhaustively reviewed.  
- E2E browser matrix not re-run in this phase.  
- Orphan docs referencing Laravel/`backend/`/`pnpm`: not fully swept.  
- Unused CSS in `globals.css`: not exhaustively classified.  
- jscpd temp report removed after summarising top clusters.  
- F-14 login timing oracle / export rate-limits: noted by authz pass as UNSURE/policy — not promoted without product decision.

---

*Phase 1 ends here. Await Phase 2 prompt for exact fixes.*
