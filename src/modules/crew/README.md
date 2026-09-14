# Crew module

Five tables: `crew_categories` / `endorsement_types` (seeded reference),
`crew_members`, `crew_certificates`, `crew_certificate_attachments`.

Read order: `crew.model.ts` (tones + list shapes) → `crew.controller.ts`
(members) → `crew-certificate.controller.ts` (certs + attachments) →
`validation.ts` → `actions.ts`. GDPR: `scrub-pii.ts` +
`src/lib/access-log/write.ts`.

## PII / GDPR (required with this module)

- **`access_logs`**: written on member/certificate **detail** views and
  attachment **downloads** — never on the list page. Export wiring is a
  TODO in `write.ts` until §15 Export reaches Crew.
- **`scrubCrewMemberPii`**: nulls personal fields on the member and their
  certificates, and deletes attachment DB rows + on-disk files.

## Certificates

Live status from `deriveComplianceStatus` with fixed
`{ kind: "expiry_offset", offsetDays: 30 }`. `cachedStatus` is write-side
only. Inline UI on the member detail page (no top-level cert routes).

## Attachments

Served via the generic `/api/attachments/[id]` route (third lookup table
after certificates and deficiencies). Downloads log
`accessType: "download_attachment"`.

Full spec: `PROJECT_PLAN.md` §3 / §6.
