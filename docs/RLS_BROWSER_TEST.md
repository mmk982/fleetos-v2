# RLS phase 1 — browser end-to-end test report

**Date:** 2026-10-29  
**Branch:** `cursor/rls-phase1` (uncommitted changes present; no commit made)  
**Method:** Cursor IDE browser against `http://localhost:3000` + owner `psql` for setup/proof.  
**Rule:** Observations only — no application code fixes.

Shared test password for all `rls-*` users: `FleetOS-RlsTest-9f3aK2!mQ` (HIBP accepted).

---

## 1. Environment proof (section 0)

### Docker / Postgres

```
NAME                    IMAGE           STATUS                    PORTS
fleetos-v2-postgres-1   postgres:17.4   Up … (healthy)            0.0.0.0:5433->5432/tcp
pg_isready -U fleetos -d fleetos → accepting connections
```

### Env (names only)

`.env.local` set to:

- `DATABASE_URL=postgres://fleetos_app:fleetos_app@localhost:5433/fleetos`
- `DATABASE_MIGRATE_URL=postgres://fleetos:fleetos@localhost:5433/fleetos`

`npm run db:migrate` → Migrations applied + seeds.  
`npm run db:ensure-app-role` → grants applied.

### Role / RLS flags (owner psql)

```
   rolname   | rolsuper | rolbypassrls
-------------+----------+--------------
 fleetos     | t        | t
 fleetos_app | f        | f

 relname                      | relrowsecurity
------------------------------+----------------
 access_logs                  | t
 certificates                 | t
 crew_certificate_attachments | t
 crew_certificates            | t
 crew_members                 | t
```

### App process

- Stopped prior listener on :3000; removed `.next`; `npm run dev` → Ready, Environments: `.env.local`.
- After hitting `/login`:

```
SELECT usename, count(*) FROM pg_stat_activity WHERE datname='fleetos' GROUP BY 1;
 usename    | count
------------+-------
 fleetos    |     1
 fleetos_app|    10
```

Runtime app connections observed as **`fleetos_app`**.

Server console note during session:

```
(node:…) DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated …
```

---

## 2. Test data inventory (do not delete yet)

| Kind | Id / key | Notes |
|---|---|---|
| Vessel A | `4e4bebf2-f84d-4c17-8997-65abf5cd054d` | UI: **RLS-TEST Vessel A**, IMO 9876501 |
| Vessel B | `b1111111-1111-4111-8111-111111111111` | Owner SQL: **RLS-TEST Vessel B**, IMO 9876502 |
| admin1 | `724f0c74-efbd-4d86-8c56-52d1c6ef7920` | `rls-admin1@example.invalid` (create-user script) |
| super1 | `a1000000-0000-4000-8000-000000000001` | `rls-super1@example.invalid` |
| ro1 | `a1000000-0000-4000-8000-000000000002` | `rls-ro1@example.invalid` |
| mgmtA | `a1000000-0000-4000-8000-000000000003` | vessel A |
| vuA | `a1000000-0000-4000-8000-000000000004` | vessel A |
| vuB | `a1000000-0000-4000-8000-000000000005` | vessel B |
| vuNone | `a1000000-0000-4000-8000-000000000006` | vessel_user, **no vessel** |
| Certs A | `caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa{1,2,3}` | RLS-A-VALID / EXPIRING / EXPIRED |
| Certs B | `cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb{1,2,3}` | RLS-B-* |
| Cert attach A/B | `daaaaaaa-…aaa1` / `dbbbbbbb-…bbb1` | files under `data/attachments/rls-test-cert-*.pdf` |
| Crew A1/A2 | `eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa{1,2}` | RLS-TEST CrewA1/A2 |
| Crew B1/B2 | `ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb{1,2}` | RLS-TEST CrewB1/B2 |
| Crew certs / attach | `faaaaaaa-…` / `fbbbbbbb-…` / `aaaaaaaa-…aa01` / `bbbbbbbb-…bb01` | Passport A1/B1 + PDFs |

Users (except admin1) created via **owner SQL** reusing admin1 password hash (Settings UI not used for bulk create). Certs/crew seeded via owner SQL. Vessel A created via UI.

---

## 3. User × page matrix

Legend: **PASS** / **FAIL** / **PARTIAL** / **CANNOT VERIFY**. Evidence is what the browser snapshot showed.

### `vuA` (`rls-vua@example.invalid`) — browser session

| Page | Result | Evidence |
|---|---|---|
| Certificates list | **PASS** | Only `RLS-TEST Vessel A` / `RLS-A-*` (3 rows). No B. URL `/dashboard/certificates` |
| Certificates `?vesselId=<B>` | **PASS** (no leak) | Still only A rows; B filter ignored (scoped override). No B names |
| Cert detail B | **PASS** | `/dashboard/certificates/cbbbbbbb-…bbb1` → **404** “This page could not be found.” |
| API cert B | **PASS** | `/api/certificates/cbbbbbbb-…bbb1` body `{"error":"Certificate not found"}` |
| Attachment B | **PASS** | `/api/attachments/dbbbbbbb-…` → `{"error":"Attachment not found: …"}` |
| Crew list | **PASS** | Only `RLS-TEST CrewA1/A2` on Vessel A |
| Crew detail B | **PASS** | 404 on `/dashboard/crew/ebbbbbbb-…bbb1` (verified on a tab; see note) |
| Alerts | **PASS** | Actionable items only Vessel A (expired/expiring A). Vessel dropdown options: “All vessels”, **RLS-TEST Vessel A** only (no B) |
| Export certs xlsx | **PASS** (blocked) | `{"error":"Insufficient access for module \"export\" (need write)."}` — `vessel_user` has `export: none` |
| Write UI | **PARTIAL** | “Add certificate” / “Add crew” / Edit still visible despite read-only matrix — UI gating gap (app bug). Mutation not pressed to completion |

### `vuB` — browser

| Page | Result | Evidence |
|---|---|---|
| Certificates list | **PASS** | Only `RLS-TEST Vessel B` / `RLS-B-*` (3 rows). No A |

### `vuNone` — browser

| Page | Result | Evidence |
|---|---|---|
| Certificates (and layout) | **FAIL** | Page “This page couldn’t load” / server error. Console: `ForbiddenError: Vessel-scoped role has no assigned vessel — access denied` from `requireScopedVesselId` → `getNavBadges` / `listCertificates`. **HTTP 500** on `/dashboard/certificates`. Expected: empty lists, no crash |

### `ro1` — browser

| Page | Result | Evidence |
|---|---|---|
| Certificates list | **PASS** | Sees **both** `RLS-A-*` and `RLS-B-*` among fleet list |
| Crew detail A | **PASS** (read) | `/dashboard/crew/eaaaaaaa-…aaa1` loads `RLS-TEST CrewA1`, passport A1, attachment link |
| Write controls | **FAIL** (UI) | Detail shows **Edit / Scrub PII / Delete / Add document / Remove** for `read_only`. Create “Add certificate” also present on list. Mutations not executed |

### `admin1` — browser

| Page | Result | Evidence |
|---|---|---|
| Login + dashboard | **PASS** | Login → `/dashboard` with fleet cards (pre-existing GLIMLIT data + later RLS-TEST) |
| Create vessel A | **PASS** | Created `RLS-TEST Vessel A` → detail URL with id above |

### `super1`, `mgmtA`

| Page | Result | Evidence |
|---|---|---|
| Full matrix | **CANNOT VERIFY** | Not logged in via browser this session |

### Notifications / Dashboard deep cards / Monthly forms / Deficiencies / Export file bytes

| Check | Result | Evidence |
|---|---|---|
| Notifications page content vs vessels | **CANNOT VERIFY** | Bell badge counts seen (e.g. vuA “2 unread”, ro1 “33”); page body not diffed for A/B names |
| Export Excel/PDF **file contents** for mgmtA | **CANNOT VERIFY** | vuA blocked by permissions; mgmtA not browser-tested; binary download not inspected |
| Monthly forms / Deficiencies load | **CANNOT VERIFY** | Not opened |
| ≥12 concurrent tab loads + idle-in-transaction | **CANNOT VERIFY** | Not run systematically. Spot `pg_stat_activity` for `fleetos_app` later showed **0 rows** (no leaked idle-in-transaction at that moment) |

---

## 4. IDOR table (`vuA` unless noted)

| Attempt | Status / body | Result |
|---|---|---|
| Cert detail B URL | 404 page | **PASS** |
| API `GET /api/certificates/<B>` | `{"error":"Certificate not found"}` | **PASS** |
| API `GET /api/attachments/<B cert attach>` | `{"error":"Attachment not found: …"}` | **PASS** |
| Crew detail B URL | 404 | **PASS** |
| Certs `?vesselId=<B>` | Still only A data | **PASS** (no B leak) |
| Export as vuA | 403 insufficient export access | **PASS** (no B file) |
| vuNone cert list | **500** ForbiddenError uncaught | **FAIL** (crash, not empty) |
| Attachment download as ro1 | **CANNOT VERIFY** | Click intercepted by Next hydration error overlay |

---

## 5. Defects / unexpected behaviour

| # | Finding | Class | Repro / console |
|---|---|---|---|
| 1 | `vessel_user` with **null vessel** (`vuNone`) causes **500** on dashboard layout / certificates via thrown `ForbiddenError` from `requireScopedVesselId` (nav badges + list) | **App bug** (fail-closed throw not mapped to empty UI) | Login as `rls-vunone@…` → open `/dashboard/certificates`. Console: `ForbiddenError: Vessel-scoped role has no assigned vessel — access denied` at `access.ts:154`, `nav-badges.ts`, `certificates/page.tsx`. `GET … 500` |
| 2 | Read-only roles (`vessel_user`, `read_only`) still see **Add / Edit / Delete / Scrub PII** controls | **App bug unrelated to RLS** (UI gating) | vuA certificates “Add certificate”; ro1 crew detail Edit/Scrub/Delete |
| 3 | `pg` DeprecationWarning: `client.query()` while already executing | **App bug** (possible nested query / ALS interaction) | Logged at first `/login` compile |
| 4 | React hydration error overlay on crew detail (button.tsx) | **App bug unrelated to RLS** | Blocked attachment click for ro1 |
| 5 | `npx tsc --noEmit` exit **2** on `src/db/client.with-db.test.ts` mock typings | **Test typing issue** (vitest still green) | Errors TS2345/TS2493 on `query.mockImplementation` |
| 6 | `NOTIFICATION_SYNC_FAILED` with same Forbidden message for vuNone | **App bug** (same as #1) | Server log JSON during vuNone login |

No evidence of cross-vessel **data leak** for `vuA` / `vuB` on certificates/crew/alerts/API paths that were opened.

---

## 6. access_logs

After ro1 opened crew A1 detail:

```
          email          | module_name | access_type | count
-------------------------+-------------+-------------+-------
 rls-ro1@example.invalid | crew        | view        |     1
```

No UI found that lists other users’ `access_logs` → **cannot read others’ logs via UI** (none exposed).

---

## 7. Automated checks (re-run at end)

```
tsc=2          # client.with-db.test.ts mock typing errors
eslint=0       # warning only in throwaway tmp-rls-http-probe.mjs
vitest=0       # 32 files / 205 tests
integration=0  # 14 RLS integration tests passed
```

---

## 8. Could not do / why

- Full matrix for **super1** and **mgmtA** (time; browser session focused on vuA/vuB/vuNone/ro1/admin1).
- Opening exported **xlsx/pdf bytes** to grep vessel names.
- Systematic **12× concurrent** page loads.
- Crew attachment download click (hydration overlay).
- HTTP cookie login probe (`tmp-rls-http-probe.mjs`) failed to complete Next server-action login (no `$ACTION_ID`); discarded as evidence.

---

## 9. Cleanup (later)

Do **not** delete in this session. Removable later by id list in §2 (vessels, users `rls-*@example.invalid`, certs/crew with `RLS-*` numbers/names, attachment files `data/attachments/rls-test-*.pdf`).

---

## 10. Retest after fixes (2026-10-29, same branch, no commit)

Fixes applied (app code only; no push/commit):

1. `client.with-db.test.ts` mock typings → `tsc` clean.
2. Unassigned vessel_user: `getNavBadges` / top-bar / phase-1 pages catch `ForbiddenError` via `isMissingVesselAssignmentError` → `NoVesselAssignedNotice` (HTTP 200). Controllers still throw.
3. Certificates + Crew UI: `canWrite` from `getModuleAccess(... ) === "write"`; Add/Edit/Delete/Scrub/upload/remove/event form hidden when not write; new/edit form routes redirect.
4. Sequential queries inside `withDb` for `getAlerts` batches and `getCertificateById` detail loads; `getNavBadges` sequential.

Test-data fix (local DB only): RLS-TEST attachment `file_path` values were bare filenames → `ATTACHMENT_PATH_ESCAPE` → 404. Updated to `data/attachments/rls-test-*.pdf`.

### 10.1 Automated outputs (pasted)

```
npx tsc --noEmit
→ exit 0 (no diagnostics)

npx eslint .
→ exit 0

npx vitest run
→ Test Files  33 passed (33)
→ Tests  211 passed (211)
→ exit 0

npm run test:integration
→ tests/integration/rls-phase1.test.ts (14 tests) passed
→ exit 0

npm run db:check
→ Everything's fine
→ exit 0

rm -rf .next; npx next build --webpack
→ Compiled successfully; TypeScript finished; Generating static pages 43/43
→ exit 0
```

### 10.2 vuNone (retest)

| Page | Result | Evidence |
|---|---|---|
| `/dashboard` | **PASS** | Snapshot: heading “No vessel assigned”; text “No vessel is assigned to your account — contact an administrator.” HTTP 200 (layout + sidebar render). |
| `/dashboard/certificates` | **PASS** | Same notice; status 200; no 500. |
| `/dashboard/crew` | **PASS** | `fetch` → status 200, `hasNotice: true`, `has500: false`. |
| `/dashboard/alerts` | **PASS** | Same. |
| `/dashboard/notifications` | **PASS** | Same. |

### 10.3 Read-only UI (retest)

| User | Page | Result | Evidence |
|---|---|---|---|
| `ro1` | Certificates list | **PASS** | `hasAddCertificate: false`, `hasEditHref: false`; still sees A+B names. |
| `ro1` | Crew list + A1 detail + cert A detail | **PASS** | No Add crew / Scrub / Edit / Add document in HTML. |
| `vuA` | Certificates / Crew / Crew A1 | **PASS** | No Add/Edit/Scrub; A only, no B. |
| `mgmtA` | Certificates / Crew | **PASS** | No Add/Edit (mgmt has certificates/crew **read**); A only. |
| `super1` | Certificates / Crew | **PASS** | Sees A+B; Add certificate / Add crew present (write role). |

### 10.4 Role matrix previously CANNOT VERIFY

| User | Pages | Result | Evidence |
|---|---|---|---|
| `super1` | Dashboard, Certificates, Crew, Alerts | **PASS** | `hasA: true`, `hasB: true` on all four; write buttons present on cert/crew lists. |
| `mgmtA` | Dashboard, Certificates, Crew, Alerts, Notifications | **PASS** | `hasA: true`, `hasB: false` on all five; no write controls on cert/crew. |

### 10.5 Exports

| Actor | Check | Result | Evidence |
|---|---|---|---|
| `vuA` | `/api/export/certificates|crew` xlsx+pdf | **PASS** (denied) | All four → **403** `Insufficient access for module "export" (need write).` (`vessel_user` has `export: none`). File contents N/A. |
| `mgmtA` | Certs/Crew xlsx (inflated `sharedStrings.xml`) | **PASS** | Certificates strings include only `RLS-TEST Vessel A` / `RLS-A-*` (3 rows); **no** Vessel B / `RLS-B`. Crew strings: `CrewA1`, `CrewA2`, `RLS-TEST Vessel A` only. |
| `mgmtA` | Certs/Crew pdf (inflate FlateDecode + hex TJ decode) | **PASS** | Decoded text: only Vessel A / CrewA*; `hasB: false`. |

### 10.6 IDOR / attachments (direct URL fetch as `vuA`)

| Attempt | Status / body | Result |
|---|---|---|
| `GET /api/attachments/daaaaaaa-…aaa1` (A cert) | **200** `application/pdf`, body starts `RLS-TEST attachment A` | **PASS** (after test-data path fix) |
| `GET /api/attachments/aaaaaaaa-…aa01` (A crew) | **200** PDF `RLS-TEST crew attach A` | **PASS** |
| `GET /api/attachments/dbbbbbbb-…bbb1` (B cert) | **403** `Vessel scope mismatch.` | **PASS** |
| `GET /api/attachments/bbbbbbbb-…bb01` (B crew) | **403** `Vessel scope mismatch.` | **PASS** |

### 10.7 Concurrency / pool (admin1)

| Check | Result | Evidence |
|---|---|---|
| 15 parallel `fetch` (8× crew A1 detail + 7× certificates list) | **PASS** | All **200**, ~5015 ms wall time; app stayed responsive. |
| `pg_stat_activity` for `fleetos_app` after stress | **PASS** | `SELECT state, count(*) … WHERE usename='fleetos_app'` → **0 rows** (no `idle in transaction`). No hang observed. |

### 10.8 Server console (retest window)

- No `DeprecationWarning: Calling client.query() when the client is already executing a query` in the retest `npm run dev` log.
- Pre-path-fix: `ATTACHMENT_PATH_ESCAPE` for bare `rls-test-*.pdf` (test-data); cleared after SQL path update.
- No `permission denied` / `new row violates row-level security policy` / `ACCESS_LOG_WRITE_FAILED` observed in the retest log.

### 10.9 Defects closed / remaining

| Prior # | Status |
|---|---|
| vuNone HTTP 500 | **Fixed** (notice UI) |
| Read-only write controls on Cert/Crew | **Fixed** |
| pg concurrent `client.query` warning | **Fixed** (no warning in retest log) |
| tsc mock typings | **Fixed** (`tsc` exit 0) |
| Attachment A 404 on first fetch | **Test-data** (`file_path` missing `data/attachments/` prefix); fixed in local DB; downloads work |

No new RLS data-leak defects observed in this retest.

---

## 11. Phase 2 browser verification (2026-10-29, `cursor/rls-phase2`, no commit)

**Method:** Playwright against `http://localhost:3000` + owner SQL seed + Cursor browser login smoke.  
**Runtime:** `DATABASE_URL=fleetos_app`, migration `0026_rls_phase2` applied (`relrowsecurity=t` on all 20 phase-2 tables).

### 11.1 Phase-2 RLS-TEST inventory (do not delete yet)

| Kind | Id | Notes |
|---|---|---|
| ISM template | `11111111-1111-4111-8111-111111111101` | RLS-TEST Monthly Drill |
| Def A/B | `d0aaaaaa-…aaa1` / `d0bbbbbb-…bbb1` | + attachments `d1aaaaaa` / `d1bbbbbb` |
| Insurance A/B | `10aaaaaa-…aaa1` / `10bbbbbb-…bbb1` | + attachments `11aaaaaa` / `11bbbbbb` |
| Manual A/B | `20aaaaaa-…aaa1` / `20bbbbbb-…bbb1` | revisions `21aaaaaa` / `21bbbbbb` |
| Drawing A/B | `30aaaaaa-…aaa1` / `30bbbbbb-…bbb1` | attachments `31aaaaaa` / `31bbbbbb` |
| Monthly req/exec A/B | `f0…` / `f1…` | attach A `f2aaaaaa-…` |
| Particulars A/B | `40aaaaaa-…` / `40bbbbbb-…` | attach A `41aaaaaa-…` |
| Notes A/B | `50aaaaaa-…` / `50bbbbbb-…` | |
| Reminders A/B/Fleet | `60aaaaaa-…` / `60bbbbbb-…` / `60ffffff-…` | Fleet = `vessel_id` NULL |
| Audits A/B | `70aaaaaa-…` / `70bbbbbb-…` | |
| PSC A/B | `80aaaaaa-…` / `80bbbbbb-…` | |
| Cert events A/B | `e0aaaaaa-…` / `e0bbbbbb-…` | on existing phase-1 certs |
| Notifs vuA/vuB | `90aaaaaa-…` / `90bbbbbb-…` | own-user only |
| Attachment files | `data/attachments/rls-test-*.pdf` | |

### 11.2 Automated verify (this branch)

```
git log --oneline -3
→ b09abf5 chore(deps): security upgrade next 16.4.3…
→ 65de95c feat(rls): run phase-1 modules through withDb…
→ 3a46c39 feat(db): row level security phase 1…

npx tsc --noEmit → exit 0
npx eslint . → exit 0
npx vitest run → 33 files / 211 tests passed
npm run test:integration → phase1 14 + phase2 12 = 26 passed
npm run db:migrate && npm run db:check → ok
npx next build --webpack → exit 0 (then .next removed)
npm audit --omit=dev --audit-level=high → exit 0 (2 moderate uuid/exceljs only)
```

`relrowsecurity=t` confirmed for all 20 phase-2 tables; `\d+ deficiencies` and `\d+ notifications` show policies `TO fleetos_app`.

### 11.3 User × module matrix (phase 2)

Legend: **PASS** = A-only or both as expected; no B leak for scoped users.

| User | Modules checked | Result | Evidence |
|---|---|---|---|
| `vuA` | Deficiencies, Insurance, Manuals, Drawings, Reminders, Audits, PSC, Particulars, Alerts, Notifications lists | **PASS** | `hasA: true`, `hasB: false` on each list; hits show only Vessel A / Def A / … |
| `vuA` | Monthly form **detail** A | **PASS** | `/dashboard/monthly-forms/f1aaaaaa-…` **200**, Monthly Drill A |
| `vuA` | Monthly form **detail** B | **PASS** | **404** |
| `vuA` | Monthly forms **list** | **FAIL** (app) | **500** `ForbiddenError: Insufficient access for monthly form requirements (need full).` — page always loads requirements CRUD |
| `vuA` | Vessel detail `?tab=notes` | **FAIL** (app) | **500** `Insufficient access for module "vessels" (need read).` (`vessel_user` has `vessels: none`) |
| `vuB` | Deficiencies, Notifications | **PASS** | Only B; `RLS-TEST Notif vuB` present; no vuA notif title |
| `mgmtA` | Deficiencies, Reminders | **PASS** | A only; no Fleet reminder; no B |
| `ro1` | Deficiencies, Reminders | **PASS** | A **and** B visible (office) |
| `admin1` | Deficiencies, Reminders, Notifications | **PASS** | A+B; Fleet reminder visible; sync notifs for both vessels |

### 11.4 IDOR / attachments (`vuA`)

| Attempt | Status / body | Result |
|---|---|---|
| Def/Ins/Man/Draw/Audit/PSC detail B URLs | **404** | **PASS** |
| `GET /api/attachments/d1aaaaaa-…` (def A) | **200** `RLS-TEST deficiency attach A` | **PASS** |
| Def/Ins/Man attach B | **404** Attachment not found | **PASS** (RLS hides row) |
| `GET /api/export/deficiencies?format=xlsx` | **403** export module | **PASS** (`vessel_user` export:none) |

### 11.5 Writes vs `MODULE_PERMISSIONS`

| Actor | Action | Result |
|---|---|---|
| `vuA` | Monthly form **submit** on A | **PASS** | Dialog upload → status **Submitted**, attachment `rls-submit-a.pdf`; RLS write allowed for `vessel_user` |
| `vuA` | Create vessel note | **Denied by design** — `particulars: read` only; RLS `app_can_write_particulars()` is admin/super. Prompt’s “create a note as vuA” conflicts with matrix; documented, not loosened |
| Integration | `vessel_user` INSERT executed form on A; refused requirements/notes | **PASS** (see `rls-phase2.test.ts`) |

### 11.10 Follow-up matrix (super1 / vuNone / dashboard)

| User | Check | Result | Evidence |
|---|---|---|---|
| `super1` | Deficiencies / Manuals / Reminders / Monthly forms list | **PASS** | A **and** B; Fleet reminder visible; monthly list **200** (full access) |
| `vuNone` | `/dashboard`, `/dashboard/notifications` | **PASS** | Notice UI; no A/B data |
| `vuNone` | `/dashboard/deficiencies`, `/reminders` | **FAIL** (app) | **500** — phase-1 notice not wired on these phase-2 list pages |
| `vuA` | Dashboard cards + links | **PASS** | Open defs / manuals / pending forms; Vessel A / Def A only; **no** B |
| `vuA` | Monthly submit e2e | **PASS** | See §11.5 — Submitted + file attached |

### 11.6 Exports (`mgmtA`)

| Check | Result | Evidence |
|---|---|---|
| `/api/export/deficiencies?format=xlsx` | **PASS** | HTTP 200, 6656 bytes; inflated `sharedStrings`/`sheet1`: `RLS-TEST Vessel A`, `RLS-DEF-A1`, `RLS-TEST Def A` only; **no** Def B / Vessel B |

### 11.7 Concurrency / pool (`admin1`)

| Check | Result | Evidence |
|---|---|---|
| 15 parallel fetches (deficiencies/reminders) | **PASS** | All **200**, ~6868 ms |
| `pg_stat_activity` `fleetos_app` idle in transaction | **PASS** | `idle_in_tx = 0` (0 rows after stress) |

### 11.8 Server console

- Monthly-forms list: `ForbiddenError` for requirements (app) — no `row-level security` violation strings for happy paths.
- No leaked `idle in transaction` after parallel load.
- Login hydration warning on `login-form.tsx` (pre-existing app/noise).

### 11.9 Defects found (phase 2 browser)

| # | Finding | Class |
|---|---|---|
| 1 | `/dashboard/monthly-forms` always calls `listMonthlyFormRequirements` (full-only) → **500** for `vessel_user` / `management_user` / `read_only` | **App bug** (not RLS) |
| 2 | Vessel detail tabs require `vessels` read → **500** for `vessel_user` even on own vessel notes | **App bug** (permissions/UI) |
| 3 | Prompt expected vuA note create; matrix + RLS correctly refuse (`particulars` write = office) | **Test-expectation / product** — keep RLS aligned with `MODULE_PERMISSIONS` |
| 4 | Login form React hydration overlay | **App bug unrelated to RLS** |

No cross-vessel **data leak** observed for phase-2 modules on list/detail/attachment/export paths tested.

