# FleetOS — Security Plan

End-to-end security plan, ordered the way a request actually flows through the app: login page in, final pre-launch checks out. This is the detailed security lens across `MASTER_PLAN.md` Phases 3 (auth), 4 (GDPR), 6 (RBAC), 7 (VPS), and 8 (security review) — it doesn't re-decide anything those phases already locked in, and it doesn't repeat `MASTER_PLAN.md` Phase 7's VPS hardening runbook verbatim (UFW/fail2ban/container specifics are already fully specified there). What it adds: the concrete, code-level security mechanics those phases assume but don't spell out — exact cookie flags, password-hashing parameters, header values, rate-limit shapes, and a lifecycle-ordered checklist so nothing gets improvised at implementation time.

Two recommendations below (Argon2id parameters, the security-header baseline) are grounded in OWASP's current cheat sheets, checked via web search rather than recalled from training — cited at the point of use. Everything else here follows directly from decisions already locked in `MASTER_PLAN.md`/`PROJECT_PLAN.md`.

**Tool assignment** follows the same split as `MASTER_IMPLEMENTATION_PLAN.md`: Claude Code implements everything below that's server-side/infrastructure (it's exactly the "must be correct and consistent everywhere" class of work); Cursor's involvement here is limited to wiring the Login page's error states to whatever the backend returns; and a short list of items — marked explicitly — are Eng.MHD's alone, because they require legal judgment, cloud-account access, or a decision neither tool should make unattended.

---

## 1. Threat model & scope

**What's actually at risk:** vessel compliance records (not generally sensitive, but business-critical — a tampered or lost expiry date has real safety/detention consequences), crew personal data (GDPR-scope PII: names, nationality, date of birth, document numbers), and the credentials/sessions that gate access to both. There is no payment data, no public-facing unauthenticated surface beyond the login page itself, and — per the deployment model — no cross-customer data path at all (`MASTER_PLAN.md`'s one-VPS-per-customer isolation means there's no multi-tenant boundary to defend at the app layer; each deployment's entire threat surface is its own).

**Realistic threat actors**, in rough order of likelihood for this kind of product: a former or disgruntled employee misusing legitimate access (this is why RBAC and activity logging matter more here than perimeter defense), credential-stuffing/brute-force against the login page (public internet-facing by definition), an over-broad role accessing data it shouldn't (misconfigured or unfinished RBAC), and supply-chain compromise via a dependency (small team, can't hand-audit every package). Nation-state-level or highly sophisticated targeted attacks are not the realistic threat model for a fleet-office compliance tool — the controls below are sized accordingly, not over-built.

---

## 2. Login page & credential security

Everything here lands with `MASTER_PLAN.md` Phase 3. **Tool: Claude Code** for all backend mechanics; **Cursor** wires the already-built Login page (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 6) to real error states.

### 2.1 Password hashing

Use **Argon2id** — OWASP's current recommended default for new projects, chosen specifically because it resists both GPU-based cracking and side-channel attacks better than the alternatives (bcrypt/scrypt/PBKDF2).<sup>[1]</sup> Two OWASP-documented parameter profiles exist, trading memory for CPU:

- `m=19456` (19 MiB), `t=2`, `p=1` — lighter memory footprint, better fit for this app's modest VPS sizing (`MASTER_PLAN.md` Phase 7: 2–4 vCPU / 4–8 GB shared with Postgres, GlitchTip, and Redis).
- `m=47104` (46 MiB), `t=1`, `p=1` — OWASP's other documented baseline; stronger memory-hardness, at the cost of more RAM per concurrent login attempt.

**Recommendation:** start with the lighter `m=19456,t=2,p=1` profile given the shared-resource VPS sizing already locked in for Phase 7, and load-test the login endpoint under concurrent attempts before go-live to confirm the app container isn't memory-starved during a burst of logins (e.g., everyone logging in at shift start). Store the parameters alongside the hash (most Argon2id libraries encode them into the hash string automatically) so a future parameter change doesn't invalidate existing password hashes.

### 2.2 Password policy

Per current OWASP guidance, prioritize **length over complexity rules**: require a minimum of 12 characters, do not enforce composition rules (mandatory special characters, etc. — these push users toward predictable substitutions and don't meaningfully improve entropy), and check new passwords against a breached-password list (e.g., the k-anonymity range of the Have I Been Pwned API, checked without ever sending the full password off-box) at set time. No forced periodic rotation — that's an outdated practice that leads to predictable incrementing (`Password1`, `Password2`) rather than better passwords.

### 2.3 The "no self-service reset" decision has a real single-point-of-failure gap — needs a break-glass procedure

`PROJECT_PLAN.md` §7a already decided: Admin sets passwords directly, no email-based self-service reset flow, in v1. That's a reasonable scope cut, but it has a consequence nobody's written down yet: **if the Admin account itself is locked out or its password is lost, nobody inside the app can recover it.** Recommend a documented (not app-feature) break-glass procedure: a small script Eng.MHD can run directly against Postgres (`UPDATE users SET password_hash = ... WHERE email = ...`, using the same Argon2id library server-side) to reset any account including Admin, kept in an operational runbook rather than exposed as a UI feature — the same "documented procedure, not a product surface" treatment already used for the GDPR breach-notification procedure in `MASTER_PLAN.md` Phase 4.

### 2.4 Brute-force / credential-stuffing protection

Rate-limit the login endpoint **both** per-IP and per-account (per-IP alone doesn't stop a distributed attempt against one specific account; per-account alone doesn't stop one IP spraying many accounts) — a reasonable starting shape is 5 failed attempts per account per 15 minutes and a coarser per-IP ceiling, with exponential backoff rather than a hard lockout. Return the same generic "invalid email or password" message regardless of which part was wrong, so the endpoint never confirms whether a given email has an account (user enumeration).

**Why backoff and not OWASP's usual lockout recommendation, specifically for this app.** OWASP's Authentication Cheat Sheet's default advice is a time-based *lockout* after 5–10 failed attempts (e.g., a ~20-minute auto-reopening lockout), and it explicitly flags the same DoS risk raised above — but OWASP's own mitigation for that risk is to let the forgot-password flow bypass the lockout, so a legitimately locked-out user can still get back in via email reset.<sup>[3]</sup> §2.3 already establishes that FleetOS has no such escape hatch in v1 — no self-service reset, Admin sets passwords directly. Without that bypass available, a hard lockout here means a locked-out user has zero recourse except manually reaching an Admin, which is a worse outcome than the DoS risk it's meant to prevent for a small fleet-office team. Exponential backoff is therefore the better fit for FleetOS's specific constraints, not a deviation from best practice for its own sake: a legitimate user who mistypes a password a few times just waits longer and is never fully shut out, while an attacker is still meaningfully slowed down.

**Two complementary controls named in the same OWASP guidance, not yet reflected anywhere in this plan:**
- **CAPTCHA as defense-in-depth** after a handful of failed attempts — OWASP frames this as raising the cost/time of automated attempts, not as the primary control. Worth adding to the login form once real backend attempts exist; not required for the v1 UI-only screen.
- **MFA as the actual long-term fix for this whole attack class** — OWASP cites analysis suggesting MFA would stop the large majority of credential-based account compromises, well beyond what rate-limiting alone achieves. `MASTER_PLAN.md` §3 already treats passkeys/MFA as a **post-v1 enhancement**, which remains a reasonable scope cut for launch — but it should be understood as the real fix, with backoff + rate limiting as v1's interim mitigation, not a permanent substitute.

### 2.5 Login page itself

Static UI already built (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 6). Nothing about the visual design changes here — the only Cursor-owned task is wiring the form's error states (invalid credentials, rate-limited, account deactivated) to whatever `loginAction` returns, using the existing form-error pattern from `vessel-form.tsx`/`actions.ts` as the reference shape.

---

## 3. Session & request-layer security

This is `MASTER_PLAN.md` Phase 3's 3-layer defense (edge redirect → Server Action re-check → DB layer), already diagrammed in `diagrams/auth-request-flow.mermaid`. The concrete mechanics that diagram assumes:

- **Cookie flags:** `httpOnly` (never readable by JS — the single biggest defense against session theft via XSS), `secure` (never sent over plain HTTP — enforced automatically once Caddy's auto-TLS is live), `sameSite=lax` (blocks the large majority of CSRF vectors while still allowing a normal top-level navigation to work, appropriate for an internal tool with no external referral links into it — `strict` is stronger and worth considering if there's genuinely never a legitimate cross-site navigation into the app).
- **Never `localStorage`/`sessionStorage` for the session token** — anything that can execute JS on the page (including a successful XSS payload) can read those; this is explicitly the most common Next.js auth mistake `MASTER_PLAN.md` already flags avoiding.
- **Session lifetime:** a bounded `maxAge` (24h was `MASTER_PLAN.md`'s suggested starting point; given this app holds crew PII, consider a shorter idle timeout — e.g., 8h idle / 24h absolute — rather than a single 24h flat expiry) plus **session-ID rotation on login and on any privilege change** (e.g., if a future admin action changes a user's role mid-session, rotate their session rather than letting the old session silently inherit new permissions).
- **CSRF, specifically for Next.js Server Actions:** Server Actions get some inherent protection from same-origin form submission, but don't rely on that alone — verify the `Origin`/`Sec-Fetch-Site` header server-side on every mutating Server Action as defense-in-depth, since a misconfigured deployment or a future public API surface could otherwise accept a cross-origin POST.
- **Every Server Action independently re-verifies the session** — this is already the stated Phase 3 design; the concrete implication for `CODE_CONVENTIONS.md` is that the session-check call belongs at the *top* of every `actions.ts` function, documented as a required first line (not just a convention followed by habit), so a future contributor adding a new action can't accidentally skip it.

---

## 4. Authorization / RBAC security

Builds on `MASTER_PLAN.md` Phase 6. The permission mapping was previously
**explicitly blocked** — this plan didn't invent it (see `PLAN_REVIEW.md`
finding #2 on why guessing it would be worse than waiting). **Eng.MHD has
since provided a starting mapping** (this session; full table in
`MASTER_IMPLEMENTATION_PLAN.md`'s Phase 6 section) — treat it as
resolved-for-now but not frozen; several cells are marked as inferred
extrapolations pending Eng.MHD's confirmation, and he'll supply
corrections/additions as they come up. What this section adds is the
enforcement *shape*:

- **Deny by default.** A role with no explicit grant for a module gets no access to it — never structure the check as "allow unless denied."
- **Enforce at the Server Action / API layer, not just the UI.** Hiding a button for a role that shouldn't see it is a UX nicety, not a security control — every `actions.ts` function and API route must independently check the caller's role against `WRITE_ROLES` before doing anything, exactly as the session check does. A role-gated nav item that's hidden in the sidebar but still reachable by directly POSTing to the Server Action is not actually gated.
- **Binary allow/deny per module, not 3-tier.** The originally-assumed "Full control / Limited upload / View only" tiering is superseded — the real design has no "limited" tier, just R/W or not per module.
- **Postgres RLS as a second, independent layer** (Phase 4/6, already planned) — the point of RLS here isn't "instead of" the app-layer check, it's a backstop for the specific failure mode where an app-layer check gets missed in one code path; the two layers should enforce the *same* rule, not different ones.
- **The sidebar-visibility question flagged in `PLAN_REVIEW.md` finding #6** (does a restricted nav item hide, disable, or stay visible-but-403 once a role can't access it) needs resolving before Phase 6 ships, since it's a real product decision, not something to improvise per-page.
- **Vessel-level scoping is confirmed real, not hypothetical.** Users split into two classes: office-based (Admin, Superintendent, Read Only — fleet-wide) and vessel-based (Management User, Vessel User — each tied to exactly one vessel via a new nullable `users.vesselId` FK, `ON DELETE RESTRICT`). This makes the RLS/app-layer check **row-level** for vessel-scoped roles (role check **and** `record.vesselId === caller.vesselId`), not just a flat per-module role check — the materially bigger implementation this bullet used to flag as an open question is now the confirmed design.

---

## 5. Input validation & injection defense

Largely already in good shape by existing convention — this section confirms the pattern holds and calls out the one place it needs active vigilance.

- **SQL injection:** Drizzle's query builder parameterizes everything by default across the entire schema — the real risk is any future `sql\`...\`` raw-template usage that interpolates user input directly instead of using Drizzle's own parameter binding. Treat any raw SQL template as a specific, flagged review item, not routine code.
- **XSS:** React escapes rendered content by default; the specific thing to forbid outright is `dangerouslySetInnerHTML` anywhere user-supplied content (notes fields, remarks, deficiency descriptions — several free-text fields exist across the schema) could reach it. If rich text ever becomes a requirement, that's a sanitization-library decision to make deliberately, not something to bolt on later.
- **Zod at every boundary** — already the established convention (`PROJECT_PLAN.md` Conventions section); the security-relevant addition is that validation must happen server-side in the Server Action/API route regardless of what client-side validation exists, since a request can always bypass the browser entirely.
- **IDOR (insecure direct object reference):** every detail/edit/delete route takes an `id` from the URL — confirm, per module, that the controller doesn't just fetch by ID but also checks the caller's role/vessel-scope allows access to *that specific row*, once RBAC exists. Before RBAC ships, this isn't yet a real gap (any authenticated user can see any vessel's data by design in the current single-tier model), but it becomes one the moment role-based restriction exists, so it belongs on the Phase 6 checklist explicitly.

---

## 6. File upload security

Every module's attachment table (`certificate_attachments`, `deficiency_attachments`, `crew_certificate_attachments`, etc. — `diagrams/erd-full-schema.mermaid` lists all of them, fixed a stale cross-reference here that pointed at `PLAN_REVIEW.md` instead) shares this exposure. `crew_certificate_attachments` (added this session, `PROJECT_PLAN.md` §3) is the specific table covering passport/visa/other sensitive personal-document scans — nothing about the procedure below is weaker or different for it than for any other module's attachments; the same controls apply uniformly. `PROJECT_PLAN.md` already fixed the max size (10 MB) and MIME allow-list (`application/pdf`, `image/jpeg`, `image/png`) — the additions:

- **Validate the file's actual content, not just the declared MIME type/extension** — a renamed `.exe` with a spoofed `Content-Type: application/pdf` header will pass a naive check; verify via magic-byte/file-signature inspection, not the client-supplied MIME string alone.
- **Store uploaded files under `data/attachments/` with a generated filename (e.g., the row's UUID), never the user-supplied original filename** — the original `fileName` stays in the DB column for display, but the on-disk `filePath` must never be derived from user input, which closes off path traversal (`../../etc/passwd`-style filenames) entirely rather than needing to sanitize it correctly.
- **Serve attachments through an authenticated route that re-checks the session/role**, not a static file mount — since `data/attachments/` isn't meant to be public, it should never be reachable by guessing/incrementing a URL without going through the same auth check every other route gets.

### 6a. Export & bulk-data security (new — previously unaddressed anywhere)

`PROJECT_PLAN.md`'s Export to Excel/PDF utility (build-order step 15) had no security treatment in any document until now — worth naming plainly: an export is the one feature in this plan whose entire purpose is to produce a file that leaves the app's access-control model entirely. Every attachment is served through an authenticated route (§6 above); an exported spreadsheet or PDF, once downloaded, is a plain file on someone's machine with none of that — no session check, no re-auth, no way to revoke access to a copy that already left.

- **Audit trail on every export, not just Crew.** Per `PROJECT_PLAN.md` §15's export note: an export whose source rows are `crew_members`/`crew_certificates` writes an `access_logs` row (§6b below) — this is the GDPR-relevant case, since crew PII is what's leaving the app. An export of any other module (Certificates, Deficiencies, Insurance, etc.) writes a plain `activity_logs` entry (`actionType: "exported"`) — not a compliance requirement, but cheap insurance so "who exported what, when" is answerable if it's ever asked, rather than genuinely unknowable.
- **No role gating in v1 — a known, accepted limitation, not an oversight.** Until Phase 6's RBAC ships, "logged in" is the only export gate, the same limitation that already applies to viewing the underlying data. Per the mapping Eng.MHD provided (`MASTER_IMPLEMENTATION_PLAN.md` Phase 6, table row "Export" — currently marked *inferred*, pending confirmation), Vessel User is expected to lose export access entirely and Management User's export is expected to be scoped to their own vessel's data only — the specifics are still provisional, but "export gets restricted for at least some roles" is no longer an open question, just an unconfirmed detail.
- **Not solved by this plan, and worth being upfront about:** once a file is exported, this plan has no mechanism to prevent it from being re-shared, and no watermarking/DRM is in scope for v1. The audit-log entry answers "did an export happen and who triggered it," not "where did the file end up." Treat this the same as any other outside-the-system risk (e.g., someone photographing a screen) — mitigated by knowing it happened, not by technically preventing downstream copying.

### 6b. GDPR access log (new — was referenced as decided, was actually just a name)

Every place this document and `MASTER_PLAN.md` mentioned a log of "who accessed what personal data" (§9's incident-response step 3, §10 below) was asserting something that didn't yet exist as a design — no schema, no owning build task. That's now fixed: `PROJECT_PLAN.md` §6 specifies the real `access_logs` table (`userId`, `moduleName`, `recordId`, `accessType`, `accessedAt`), and `MASTER_IMPLEMENTATION_PLAN.md`'s Phase 4 checklist now owns building it alongside the Crew module.

Deliberately narrow scope, same data-minimization principle already applied to `scrubCrewMemberPii`: it only logs reads of `crew_members`/`crew_certificates`/`crew_certificate_attachments` — a member/certificate detail-page view, an attachment download, or an export (§6a) — not a general page-view log for the whole app. The Crew **list** page doesn't trigger it, since the list shows only names/status, not the personal-data fields this log exists to track.

---

## 7. Data protection

- **Encryption at rest:** VPS disk-level (LUKS), per `MASTER_PLAN.md` Phase 7 — not repeated here beyond confirming it's the right layer (application-level column encryption isn't warranted for this data classification and would break the reference-table/filter patterns used throughout, e.g. searching by certificate number).
- **Encryption in transit:** Caddy's automatic TLS (Phase 7) plus HSTS (§8 below) so a browser never falls back to plain HTTP after the first successful HTTPS connection.
- **Secrets:** environment variables only, `.env.example` documents required keys with no real values (already the established pattern from `MASTER_IMPLEMENTATION_PLAN.md` Phase 2.2), never committed to git, and **rotated immediately if a secret is ever suspected exposed** (e.g., accidentally committed, then removed) — a rotation, not just a revert, since git history retains the old value regardless of a later commit removing it.
- **GDPR scrub-PII, breach notification, record of processing** — already scoped to `MASTER_PLAN.md` Phase 4 and `MASTER_IMPLEMENTATION_PLAN.md`'s Phase 4 tasks; not repeated here.
- **Backups:** encrypted at rest on Backblaze B2 (Phase 7), and — worth adding explicitly since it's not stated anywhere yet — **periodically test-restored**, not just taken. An untested backup is a hope, not a control; a quarterly restore-to-a-scratch-environment drill is cheap insurance relative to discovering a backup is corrupt during a real incident.

---

## 8. Application-layer hardening

**New in this document** — none of the existing plans specify header/rate-limit mechanics yet.

### 8.1 Security headers

Per OWASP's Secure Headers Project baseline for a production HTTPS site<sup>[2]</sup>, set on every response (Next.js `next.config.ts` headers, or Caddy — pick one layer and keep it there, not split across both):

- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — enforced once TLS is confirmed stable (adding `preload` is a further, harder-to-reverse step; skip it initially).
- `Content-Security-Policy` — start restrictive (`default-src 'self'`), since this app has no legitimate need to load scripts/styles from third-party origins; loosen only for specific, named exceptions if one arises (e.g., a font CDN).
- `X-Content-Type-Options: nosniff` — prevents MIME-sniffing-based attacks.
- `Referrer-Policy: strict-origin-when-cross-origin` — avoids leaking full URLs (which could contain sensitive query params) to third-party referrer targets.
- `Permissions-Policy` — deny by default for camera/microphone/geolocation/etc., since none are used.
- The cross-origin trio (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, `Cross-Origin-Resource-Policy`) — **test carefully before enabling `COEP`/`CORP`** specifically; they can break embedding of same-origin resources (like the PDF attachments this app serves) if the policy is stricter than the actual resource-loading pattern. Recommend `COOP: same-origin` immediately, and treat `COEP`/`CORP` as a follow-up once the attachment-serving route (§6) is finalized and can be tested against the policy.

### 8.2 Rate limiting beyond login

Extend §2.4's login rate-limiting to every mutating Server Action/API route, not just login — a coarser general ceiling (e.g., per-account, per-minute) is enough to blunt an automated script hammering the API, distinct from the tighter login-specific limits.

### 8.3 CORS

No legitimate cross-origin caller exists for this app (no public API, no separate frontend origin) — the default should be **no CORS headers at all** (same-origin only) rather than an open or wildcarded policy; if a future integration genuinely needs cross-origin API access, that's a deliberate, named exception, not a default.

---

## 9. Infrastructure & deployment security

Fully specified in `MASTER_PLAN.md` Phase 7 (UFW default-deny, fail2ban, non-root/read-only containers, pinned image versions, Trivy scanning, Caddy TLS) — not repeated here. Two additions this plan surfaces that Phase 7's runbook doesn't currently mention:

- **The single-person VPS-maintenance bus-factor risk** already flagged in `PLAN_REVIEW.md` finding #9 — a credential-escrow plan (shared password manager vault per customer: Hetzner, Backblaze, DNS, GlitchTip) is a security control, not just an operational nicety, since "only one person can access the infrastructure to respond to an incident" is itself a security gap.
- **Firewall the database.** Postgres should bind to the Docker-internal network only, never expose 5432 externally even behind the VPS firewall — the app container is the only thing that should ever reach it. Worth stating explicitly in the Compose file's network configuration rather than assuming it.

---

## 10. Logging, monitoring & alerting

- **Two logically separate logs, kept genuinely separate in practice:** the product `activity_logs` table (`PROJECT_PLAN.md` §6 — "what changed") and the GDPR `access_logs` table (§6b above, `PROJECT_PLAN.md` §6 — "who accessed what personal data," scoped to Crew only). Don't let engineering convenience quietly merge them later; they answer different questions for different audiences (a product manager vs. a data-protection inquiry).
- **Security-specific logging**, distinct from both of the above and from general application errors (`GlitchTip`, Phase 2): failed login attempts (with enough context to detect a credential-stuffing pattern — timestamp, account, source IP — but never the attempted password itself), permission-denied events once RBAC exists, and session anomalies (e.g., a session used from a very different IP mid-session, if that's worth detecting given the threat model). This is OWASP Top 10 2025 item #9, already named in `MASTER_PLAN.md` Phase 8 — this section is what makes it concrete rather than aspirational.
- **Alerting, not just storage.** A log nobody looks at until after an incident isn't a detection control. At minimum, a simple threshold alert (e.g., N failed logins for one account in an hour) routed somewhere a human actually sees it — this can be as lightweight as a GlitchTip alert rule initially, doesn't need a dedicated SIEM at this scale.

---

## 11. Dependency & supply-chain security

- **`npm audit` in CI** (already implied by `MASTER_PLAN.md` Phase 2's lint+typecheck pipeline — add it as an explicit CI step, failing the build on high/critical findings, not just a manual occasional check).
- **Trivy image scanning before every deploy** (Phase 7, already planned) — gates the deploy job specifically, not just a periodic scan disconnected from the release process.
- **Pin dependency versions** (already the stated convention for Docker images in Phase 7 — extend the same discipline to `package.json`, avoiding unpinned `^`/`~` ranges for security-sensitive packages like the auth/hashing libraries specifically, even if broader ranges are fine elsewhere).
- **A lightweight update cadence** — Dependabot or Renovate opening PRs for dependency updates automatically, reviewed and merged on a regular cadence rather than only when a specific CVE forces the issue.

---

## 12. Incident response

`MASTER_PLAN.md` Phase 4 already commits to a GDPR 72-hour breach-notification procedure "worth having... before any customer holds real crew data" but doesn't yet contain the procedure itself. Minimum viable version, to write out (not code) before Phase 3 ships real accounts:

1. **Detect** — via the alerting in §10, or a direct report.
2. **Contain** — the concrete first actions: rotate the affected secrets/sessions (a documented command, not something to figure out live), and, if the database itself is suspected compromised, isolate the VPS from the network before further investigation.
3. **Assess** — what data was actually exposed, using the activity/access logs from §10 to scope it, not guess at it.
4. **Notify** — the GDPR 72-hour clock starts here if personal data was involved; this step needs a named person (Eng.MHD, or eventually a DPO) and is explicitly a legal judgment call, not something either tool should draft language for unreviewed.
5. **Recover** — restore from the tested backups in §7, not an ad-hoc rebuild.
6. **Post-mortem** — blameless, written, feeding back into this document if it reveals a gap.

The `engineering:incident-response` skill can structure this into a fuller runbook when it's time to write it in full; this section is the outline that runbook should follow, not a replacement for it.

---

## 13. Pre-launch security checklist

Maps directly onto `MASTER_PLAN.md` Phase 8's OWASP Top 10 (2025) pass — restated here as literal, checkable items rather than a narrative, so it functions as a real gate before any customer goes live:

- [ ] **Broken Access Control** — every Server Action/API route checked for a role/session guard; IDOR check per module (§5) once RBAC ships.
- [ ] **Security Misconfiguration** — headers from §8.1 present on every response; no default credentials anywhere (Postgres, GlitchTip, Redis); debug/verbose error output disabled in production.
- [ ] **Software Supply Chain Failures** — `npm audit`/Trivy both green (§11).
- [ ] **Cryptographic Failures** — Argon2id parameters confirmed (§2.1); TLS-only confirmed (no HTTP fallback); backups encrypted (§7).
- [ ] **Injection** — no raw SQL string interpolation anywhere (§5); Zod validation confirmed present on every mutating endpoint, not just the UI form.
- [ ] **Insecure Design** — this document plus `MASTER_PLAN.md`/`PROJECT_PLAN.md` reviewed as a whole once Phases 3–7 are real, per Phase 8's own framing.
- [ ] **Identification & Authentication Failures** — session `maxAge`/rotation confirmed (§3); rate limiting confirmed live on login (§2.4), not just planned.
- [ ] **Data Integrity Failures** — the RESTRICT/CASCADE/SET NULL delete policy spot-checked against the actual migrated schema, not just the plan document.
- [ ] **Security Logging & Alerting Failures** — §10's alerting actually firing on a test trigger (e.g., deliberately fail a login 5 times and confirm something visible happens), not just theoretically configured.
- [ ] **Mishandling of Exceptional Conditions** — confirm a thrown error never leaks a stack trace or internal path to the browser in production mode; confirm failures fail closed (deny access) rather than open anywhere an auth check could itself error.
- [ ] **Backup restore drill** completed at least once (§7) before the first real customer's data is at stake.
- [ ] **Break-glass admin recovery procedure** (§2.3) written down and location known to more than one person.

**Sign-off:** per `MASTER_PLAN.md`'s standing caveat, this checklist produces findings for Eng.MHD (and, for the GDPR-specific items, a real DPO/lawyer) to act on — neither tool can certify legal/compliance sign-off, only verify the technical controls listed above are actually in place.

---

## 14. Ongoing security posture (post-launch)

Not a one-time gate — a cadence to keep:

- Dependency updates reviewed on a regular schedule (§11), not just reactively.
- Periodic access review: who has an account, whether their role still matches their job, whether any account should be deactivated (ties into the existing Deactivate/Activate flow, `PROJECT_PLAN.md` §7a).
- Periodic backup-restore drills (§7), not a one-time pre-launch check.
- Re-run the §13 checklist after any material change to auth, RBAC, or the deployment stack — not just before the very first launch.

---

## Sources

Argon2id parameter guidance, the security-headers baseline, and the brute-force lockout-vs-backoff reasoning in §2.1, §8.1, and §2.4 were verified via web search rather than recalled from training, given how these recommendations tend to shift:

1. [Password Storage - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
2. [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
3. [Authentication - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
