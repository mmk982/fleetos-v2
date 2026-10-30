# Record of processing activities (ROPA) — DRAFT

**DRAFT — requires review by the data controller / a qualified person. Not legal advice.**

## Open question (do not assume)

**Which legal framework applies to this deployment?** GDPR (EU/EEA), UK GDPR, another national data-protection law, or none of the above? The controller must record the answer before go-live. Sections below are written so they remain usable either way; statements that only matter under GDPR are labelled **“if GDPR applies”**.

---

## Controllers / processors (placeholders)

| Role | Name / org | Contact | Notes |
| --- | --- | --- | --- |
| Data controller | `[HUMAN]` | `[HUMAN]` | Who determines purposes of FleetOS for this fleet |
| Hosting processor | `[HUMAN]` VPS / cloud provider | `[HUMAN]` | Runs Docker stack; see DPA |
| Email processor (optional) | Resend or other if `RESEND_API_KEY` set | `[HUMAN]` | Only if digest enabled |
| Backup offsite (optional) | B2 / rclone remote | `[HUMAN]` | Encrypted bundles only if age used |
| Error tracking (optional) | GlitchTip self-host or SaaS | `[HUMAN]` | May receive error metadata |

---

## Processing activities (from current code / schema)

### 1. User accounts and authentication

| | |
| --- | --- |
| **Purpose** | Authenticate office/vessel users; authorise module access |
| **Data subjects** | Employees / contractors given a FleetOS login |
| **Categories** | `users`: name, email, password_hash (argon2id), role, vessel_id, is_active, last_login_at, preferred_locale/theme, timestamps |
| **Related** | `sessions` (user_id, expires_at); `login_attempts` (**HMAC hashes only** of email/IP — no cleartext) |
| **Lawful basis** | `[HUMAN — to be decided]` (if GDPR applies: typically contract / legitimate interests — confirm) |
| **Retention (today)** | Users kept until deactivated/deleted by admin. Sessions expire per app config; no automatic purge job beyond expiry checks. `login_attempts` cleaned opportunistically (~1% of failures) for old windows — **not** a hard retention policy |
| **Recipients** | Hosting provider (DB); optional GlitchTip (errors) |

### 2. Crew personal data (PII)

| | |
| --- | --- |
| **Purpose** | Crew compliance / certificates for assigned vessels |
| **Data subjects** | Seafarers / crew recorded in the system |
| **Categories** | `crew_members`: first_name, last_name, nationality, date_of_birth, category, vessel, status; `crew_certificates` (+ endorsement metadata); `crew_certificate_attachments` (file name + on-disk file under `data/attachments/`) |
| **Access logging** | `access_logs`: user_id, module_name, record_id, access_type, accessed_at (who viewed/exported crew PII) |
| **Erasure support** | `scrubCrewMemberPii` nulls/sentinel-erases PII and deletes attachment files; **keeps** the crew row for FK/history |
| **Retention (today)** | Kept until scrubbed or deleted via app; **no** automatic purge |
| **Lawful basis** | `[HUMAN]` (if GDPR applies: often legal obligation / legitimate interests for maritime compliance — confirm) |

### 3. Operational activity and notifications

| | |
| --- | --- |
| **Purpose** | Dashboard “recent activity”, in-app alerts, optional admin email digest |
| **Categories** | `activity_logs` (user_id SET NULL on user delete, free-text description); `notifications`; `email_deliveries` (recipient user + digest date) |
| **Retention (today)** | **Kept forever** — no purge job |
| **Personal data?** | May identify users via user_id / descriptions; treat as personal where linked |

### 4. Company profile

| | |
| --- | --- |
| **Categories** | `company_profile`: company name, logo path/file, related settings |
| **Subjects** | Organisation (may include contact details if stored in free text) |

### 5. Vessel / compliance records (generally non-PII; may link to users)

Certificates, deficiencies, insurance, manuals, drawings, PSC, audits, particulars, reminders, etc. Attachment files may contain scans with incidental personal data. Controllers should treat uploads as potentially sensitive.

---

## Transfers

| Transfer | Mechanism | Notes |
| --- | --- | --- |
| Hosting region | `[HUMAN]` | Record where the VPS and backups live |
| Offsite backups | age-encrypted `.tar.age` via rclone (optional) | Public age key on server only |
| Email | Resend API if enabled | `[HUMAN]` DPA / region |
| **If GDPR applies** | Document adequacy / SCCs / other transfer tool for any non-EEA processor | `[HUMAN]` |

---

## Security measures actually implemented (code / ops templates)

- Postgres RLS (25 tables in migrations 0025–0026) + runtime role `fleetos_app` (NOSUPERUSER, NOBYPASSRLS); production guard refuses superuser/BYPASSRLS
- Argon2id password hashing; session cookies httpOnly/signed
- Login rate limit with **hashed** keys; `TRUSTED_PROXY_HOPS` for client IP behind Caddy
- Security headers (CSP, HSTS in production, COOP, Permissions-Policy, …) via `next.config.ts`
- Encrypted backups (`age` public recipient); restore refuses live DB without explicit flag
- Attachment path confinement under `data/attachments/`
- Optional GlitchTip; no secrets in image layers (compose must not inject owner DB password into `app`)

## Gaps (see also `RETENTION_AND_GAPS.md`)

- No automatic retention purge for access/activity logs, sessions (beyond expiry), notifications, email_deliveries
- Legal framework / DPIA / DPA texts not completed (`[HUMAN]`)
- Backup copies retain historical PII until retention + re-encryption strategy decided
- StatusPill contrast / a11y owner decisions unrelated to privacy but open

---

*Last drafted: 2026-10-30 — status: drafted, **not** approved.*
