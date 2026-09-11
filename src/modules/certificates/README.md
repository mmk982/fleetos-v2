# Certificates module

Five tables: two seeded reference tables (`certificate_types`,
`issuing_authorities`), the `certificates` records, `certificate_events`
(history log), and `certificate_attachments`.

Read order for a new contributor: `certificate.model.ts` (types +
`effectiveOffsetDays`) → `certificate.controller.ts` (queries, engine
wiring, attachment storage) → `validation.ts` → `actions.ts`.

## Relationships

- `certificates.vesselId` → `vessels` (**RESTRICT**)
- `certificates.certificateTypeId` → `certificate_types` (**RESTRICT**)
- `certificates.issuingAuthorityId` → `issuing_authorities` (**RESTRICT**, nullable)
- `certificate_events` / `certificate_attachments` → `certificates` (**CASCADE**)
- `certificate_attachments.uploadedBy` → `users` (**SET NULL**)

Reminder status is **never** trusted from `cachedStatus` — every list/detail
read calls `deriveComplianceStatus` from `src/lib/expiry` with the type's
rule and the instance's dry-dock / custom-offset precedence (§1).

Attachments are stored under `data/attachments/` with generated filenames and
served only through `/api/attachments/[id]` (`SECURITY_PLAN.md` §6).

Full spec: `PROJECT_PLAN.md` §1.
