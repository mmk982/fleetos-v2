# Data-subject request runbook — DRAFT

**DRAFT — requires review by the data controller / a qualified person. Not legal advice.**

## Open question

**Which legal framework applies?** Access / rectification / erasure / portability rights differ by regime. **If GDPR applies**, respond within one month (extendable) — confirm deadlines with the controller. Placeholder SLA: `[HUMAN]`.

Identity verification before disclosing data: `[HUMAN — process]`.

---

## Find a crew member’s data (app features)

1. Sign in as a role with `crew` read (Admin / appropriate office roles).
2. **Crew** list / detail: `crew_members` fields (name, nationality, DOB, vessel, status).
3. Nested **crew certificates** and **attachments** (download via `/api/attachments/…`).
4. **Access logs** (where exposed in UI / exports): who accessed that crew PII.
5. Related **activity_logs** may mention the crew member in free-text descriptions.
6. **Notifications** may reference certificate/crew due items for users.

Vessel / certificate modules may hold incidental PII inside uploaded PDFs — search by vessel + date when relevant.

## Export

- Use in-app **export** routes where available (e.g. crew CSV/export API under `/api/export/…` — confirm current list in code).
- Attachment files: download individually; there is **no** single “zip all PII” button today.
- DB-level export for legal holds: owner `pg_dump` — `[HUMAN]` only, never from `fleetos_app` for full dumps.

## Correct

- Edit crew member / certificate fields in the UI (roles with write).
- Replace attachments: upload new + delete old as needed.
- User account email/name: **Users & Roles** (admin).

## Erase / scrub

- Prefer **`scrubCrewMemberPii`** (admin/write path documented in crew module): sets name sentinel `[erased]`, nulls other PII columns, deletes crew certificate attachment rows **and** on-disk files; **keeps** the crew row for referential integrity.
- Deactivate app users (`is_active`) rather than hard-delete when audit trails must remain; hard-delete cascades **sessions**.

## What cannot currently be done (gaps → follow-ups)

| Gap | Detail |
| --- | --- |
| Backups | age bundles retain historical PII until retention expires; no selective erase inside a bundle |
| `activity_logs` | Descriptions not scrubbed by crew PII scrub |
| `access_logs` | Remain after scrub (audit of access); no subject-driven delete UI |
| `notifications` / `email_deliveries` | Not cleared by crew scrub |
| Portability package | No one-click machine-readable pack of all subject data |
| User hard-delete UX | May leave activity rows with `user_id` null but descriptions intact |

---

*Last drafted: 2026-10-30 — status: drafted, **not** approved.*
