# Personal-data breach procedure — DRAFT

**DRAFT — requires review by the data controller / a qualified person. Not legal advice.**

## Open question

**Which legal framework applies?** Do not assume GDPR. **If GDPR applies**, notification to the supervisory authority is due **within 72 hours of awareness** unless the breach is unlikely to result in a risk to natural persons — confirm the exact duty and the competent authority with the controller.

Placeholder deadline / authority: `[HUMAN — e.g. authority name, hours, contact]`.

---

## Detection sources in this system

| Source | What it may indicate |
| --- | --- |
| App / Caddy / Postgres logs | Auth anomalies, 5xx spikes, unexpected admin actions |
| GlitchTip (if enabled) | Unhandled exceptions; review for data leakage in messages |
| `LOGIN_RATE_LIMIT_UNAVAILABLE` log code | Limiter cannot read DB / weak `SESSION_SECRET` — fail-closed logins |
| Failed-login spikes (`login_attempts`) | Credential stuffing / lockout abuse (keys are hashed) |
| RLS / `ForbiddenError` / mapped `42501` bursts | Possible probing or misconfiguration |
| Backup / restore failures | Integrity or availability incident |
| Human report | Lost device, mis-sent email, exposed env file |

## Triage (first hour)

1. Assign incident lead: `[HUMAN name/phone]` · deputy: `[HUMAN]`
2. Record time of awareness (UTC), systems touched, data categories suspected
3. Preserve evidence: snapshot relevant logs; **do not** wipe hosts yet
4. Classify: confidentiality / integrity / availability; personal data involved? (Y/N/unknown)

## Containment actions available in FleetOS ops

| Action | How (high level) |
| --- | --- |
| Rotate `SESSION_SECRET` | Redeploy with new secret — **signs everyone out**; orphans rate-limit rows (~15 min) |
| Revoke sessions | Delete `sessions` rows for affected users (owner DB) or deactivate user (`is_active`) |
| Disable user | Users & Roles UI / DB `is_active = false` |
| Block at edge | Caddy / UFW / fail2ban — `[HUMAN]` on VPS |
| Restore | `scripts/backup/restore.sh` only with `--i-know-this-overwrites-production` after verify-restore |
| Rotate DB passwords | Owner + `fleetos_app`; sync via migrate/`ensure-app-role` |
| Rotate `CRON_SECRET` | Redeploy + update systemd `cron.env` |

## Evidence preservation

- Export container logs (`docker compose logs`) and host syslog for the window
- Copy latest age backup + checksum off-box before any destructive restore
- Note GlitchTip event IDs; do not paste secrets into tickets

## Notification decision tree

```
Personal data involved?
  no → document availability/integrity incident; no privacy notice unless policy says otherwise
  yes → Risk to individuals?
         unlikely → document reasoning; [if GDPR applies] may skip authority notice — confirm
         possible/likely → prepare notices
              [if GDPR applies] → authority within placeholder deadline (often 72h)
              → data subjects without undue delay if high risk
```

Templates: `[HUMAN — letterheads / email wording]`.

## Roles (fill names)

| Role | Name | Phone / email |
| --- | --- | --- |
| Incident lead | `[HUMAN]` | `[HUMAN]` |
| Technical lead | `[HUMAN]` | `[HUMAN]` |
| Legal / DPO (if any) | `[HUMAN]` | `[HUMAN]` |
| Communications | `[HUMAN]` | `[HUMAN]` |

## Post-incident review template

1. Timeline (detect → contain → recover)
2. Root cause
3. Data categories & approximate subject counts
4. Notices sent (authority / subjects) — dates
5. Control improvements (code, ops, training)
6. Follow-up tickets

---

*Last drafted: 2026-10-30 — status: drafted, **not** approved.*
