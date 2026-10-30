# Retention behaviour and gaps — DRAFT

**DRAFT — requires review by the data controller / a qualified person. Not legal advice.**

## Open question

**Which legal framework applies?** Retention periods below marked **“to be decided”** are proposals only.

---

## Today’s actual behaviour (code)

| Store | Automatic expiry / purge? | Notes |
| --- | --- | --- |
| `sessions` | Expiry timestamp enforced at validation | No periodic DELETE job for expired rows |
| `login_attempts` | Opportunistic cleanup (~1% of recorded failures) | Not a hard retention SLA |
| `access_logs` | **None** — kept forever | Crew PII access audit |
| `activity_logs` | **None** — kept forever | Free-text may include names |
| `notifications` | **None** | Read/unread only |
| `email_deliveries` | **None** | Digest dedupe history |
| `users` / crew / certificates | Until admin action / scrub | |
| Attachments on disk | Until row delete / scrub | Volume backed up with DB |
| Encrypted backups | Retention via `BACKUP_RETENTION_*` on host | Offsite rclone optional |

## Proposed periods (to be decided)

| Store | Proposal | Owner decision |
| --- | --- | --- |
| Expired `sessions` | Daily delete where `expires_at < now()` | `[HUMAN]` |
| `login_attempts` | Delete windows older than 24h | `[HUMAN]` |
| `access_logs` | 12–24 months then archive/delete | `[HUMAN]` |
| `activity_logs` | 12–24 months | `[HUMAN]` |
| `notifications` | Delete read items > 90 days | `[HUMAN]` |
| `email_deliveries` | 24 months | `[HUMAN]` |
| Backups | Keep matching legal hold + `BACKUP_RETENTION_*` | `[HUMAN]` |

## Small implementation sketches (do **not** implement in this draft)

1. **Expired sessions** — cron/systemd oneshot: `DELETE FROM sessions WHERE expires_at < now()` as owner or a dedicated maintenance role.
2. **login_attempts** — scheduled `DELETE … WHERE window_started_at < now() - interval '1 day'` (already noted in `docs/DEPLOY.md`).
3. **access_logs / activity_logs** — monthly job with configurable `RETENTION_DAYS`; export to cold storage before delete if required.
4. **notifications** — `DELETE FROM notifications WHERE is_read AND created_at < …`.
5. **email_deliveries** — same pattern on `sent_at` / `digest_date`.

Each job needs: owner URL or migration-granted maintenance function, systemd timer, RUNBOOK entry, and a dry-run flag.

---

*Last drafted: 2026-10-30 — status: drafted, **not** approved.*
