# Insurance module

Two tables: `insurance_policies` (vessel-linked, fixed 30d expiry rule) and
`insurance_attachments` (owned children, CASCADE).

Read order: `insurance.model.ts` → `insurance.controller.ts` →
`validation.ts` → `actions.ts`.

## Compliance

Live status from `deriveComplianceStatus` with
`INSURANCE_REMINDER_RULE` (`expiry_offset` 30d). `cachedStatus` is
write-side only.

## Attachments

Served via generic `/api/attachments/[id]` (fourth lookup table). No
GDPR `access_logs` — Crew-only scope (`SECURITY_PLAN.md` §6b).

Full spec: `PROJECT_PLAN.md` §4.
