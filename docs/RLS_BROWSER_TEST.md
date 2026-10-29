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
