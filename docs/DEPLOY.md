# FleetOS production deploy runbook (fresh Ubuntu LTS VPS)

Placeholders only — no real hostnames, IPs, or secrets in this repo.
Every step that needs the VPS, DNS, or cloud accounts is marked **`[HUMAN]`**.

## Decisions for the human (confirm before go-live)

| Topic | Default in this repo | Confirm |
| --- | --- | --- |
| Reverse proxy | Caddy 2.9.x (auto TLS) | Keep Caddy vs alternate |
| Disk encryption | **LUKS** at provision time (provider/image choice) | `[HUMAN]` enable at create — cannot be bolted on later safely |
| Backup retention | 7 daily / 4 weekly / 6 monthly | Adjust `BACKUP_RETENTION_*` |
| Body size (Caddy) | 12 MB (app limit **10 MB** in `certificate.controller.ts` `MAX_ATTACHMENT_BYTES`) | Keep headroom? |
| Backup region (B2) | `[HUMAN]` pick region; privacy of compliance + crew PII off-box | Document DPA / region |
| Single VPS | App + Postgres + Caddy co-located | Accept SPOF or plan HA later |
| age private key custody | Offline / password manager — **never** on the VPS | Named holders |

RPO/RTO are **targets to confirm**, not promised SLAs — see `docs/RUNBOOK.md`.

## Ordered runbook

### 1. Provision & host hardening — `[HUMAN]`

1. Create Ubuntu LTS VPS; **decide LUKS/disk encryption at provision**.
2. Create non-root user `deploy` with sudo; disable password SSH; **SSH keys only**.
3. UFW: allow **22/tcp, 80/tcp, 443/tcp** only; default deny incoming.
4. Install and enable **fail2ban** (sshd jail minimum).
5. Enable **unattended-upgrades** for security patches.
6. Install Docker Engine + Compose plugin from Docker’s official packages (**no `curl | sh` from random URLs** — follow docs.docker.com for the Ubuntu version).
7. Point DNS `A`/`AAAA` for `DOMAIN` (e.g. `app.example.com`) at the VPS — `[HUMAN]`.

### 2. App files on the host — `[HUMAN]`

```bash
# On the VPS as deploy:
sudo mkdir -p /opt/fleetos /var/backups/fleetos /etc/fleetos
sudo chown deploy:deploy /opt/fleetos /var/backups/fleetos
# Clone or copy release tree to /opt/fleetos (git pull of a tagged release).
cp /opt/fleetos/.env.production.example /opt/fleetos/.env.production
chmod 600 /opt/fleetos/.env.production
# Edit CHANGE_ME values (DOMAIN, passwords, SESSION_SECRET, CRON_SECRET, …).
# Keep TRUSTED_PROXY_HOPS=1 (Caddy is the only proxy) — see "Login rate limiter & client IP" below.
```

Generate secrets (≥32 chars):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Database role / migration order (see `docs/RLS.md`)

Compose already runs a one-shot **`migrate`** service before **`app`**:

1. Postgres starts (owner from `POSTGRES_OWNER_*`).
2. `migrate` runs `ensure-app-role` (creates `fleetos_app` if missing using `FLEETOS_APP_PASSWORD`) + `db:migrate`.
3. `app` starts with `DATABASE_URL` as **`fleetos_app` only** (no migrate URL).

Production role guard: app refuses superuser/BYPASSRLS when `NODE_ENV=production`.

### 4. First bring-up — `[HUMAN]`

```bash
cd /opt/fleetos
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml ps
# Expect: migrate Exited 0, postgres healthy (no host port), app healthy, caddy up
```

Create first admin (from a break-glass host shell with migrate URL, or a one-off container):

```bash
# [HUMAN] Use owner URL only in a throwaway exec — not in the app container env.
docker compose -f docker-compose.prod.yml run --rm -e DATABASE_URL=… migrate \
  npx tsx scripts/create-user.ts "Admin" admin@example.com 'CHANGE_ME_STRONG_PASSWORD'
```

### 5. Smoke tests — `[HUMAN]`

1. HTTPS login at `https://$DOMAIN/login`.
2. Upload one certificate/crew attachment; download via `/api/attachments/…`.
3. As owner: `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname='fleetos_app';` → `f/f`.
4. `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('certificates','crew_members','crew_certificates','crew_certificate_attachments','access_logs');` → all `t`.
5. Confirm Postgres is **not** listening on the public interface (`ss -lntp` — no `:5432` on 0.0.0.0).

6. **Client IP / rate limiter** — see the section below: confirm the app records the real client IP (rightmost `X-Forwarded-For` hop) and that a forged `X-Forwarded-For` does not change the IP bucket.

### Login rate limiter & client IP — production notes

Added with migration `login_attempts` (auth-hardening branch). Read before go-live:

1. **Set `TRUSTED_PROXY_HOPS=1`** in `.env.production`. With Caddy as the only proxy, the application takes the address Caddy appended (the rightmost `X-Forwarded-For` entry). With `0` (the code default) `X-Forwarded-For` is ignored and the code falls back to `X-Real-IP`, which a client can set itself if it can reach the app, or to the shared `"unknown"` bucket — in that case one attacker's 40 failures lock the IP bucket for **everyone**. `0` is acceptable on a developer laptop only.
2. **The app must only be reachable through Caddy.** No published app port in `docker-compose.prod.yml` (check with `docker compose -f docker-compose.prod.yml ps` and `ss -lntp`); otherwise the header can be forged by connecting to the app directly.
3. **Verify on the real server `[HUMAN]`** (cannot be verified from a laptop):
   - From a machine outside the VPS send 2–3 wrong logins to `https://$DOMAIN/login` with a forged header, e.g. `curl -s -o /dev/null -H 'X-Forwarded-For: 1.2.3.4' -X POST …` (use the form/action your browser uses, or just a browser).
   - As the DB owner: `SELECT scope, left(key_hash,8) AS k, failure_count FROM login_attempts ORDER BY updated_at DESC;`
   - Expected: the `ip` row's hash prefix is the **same** whether or not you forge a leftmost value, and it changes only when you connect from a different real address. If it changes with the forged value, `TRUSTED_PROXY_HOPS` or the proxy chain is wrong — stop and fix before go-live.
   - Entries contain hashes only (no e-mails or IPs in clear text).
4. **Policy facts to know:** 5 failures per account and 40 per IP per 15 minutes, with exponential backoff (`min(2^(n-1) s, 15 min)`) per bucket. Because the IP bucket also backs off, **about 10 failures from one address delay all users behind that address for 8+ minutes** (offices behind one NAT share it). Product decision: keep, or raise the IP ceiling / soften the IP backoff.
5. **Targeted lockout:** anyone can lock a known account for the rest of the window by failing 5 logins (no CAPTCHA/MFA in v1). Break-glass for an administrator locked out: `DELETE FROM login_attempts WHERE scope = 'account';` as the DB owner (keys are hashed, so single accounts cannot be selected by e-mail), then log in.
6. **Fail-closed:** if the limiter cannot read the table (database error, or `SESSION_SECRET` missing/<32 chars) logins are refused with the generic "invalid email or password" and `LOGIN_RATE_LIMIT_UNAVAILABLE` is logged (no personal data). Watch for that code in the logs / GlitchTip after every deploy.
7. **Rotating `SESSION_SECRET`** signs everyone out and orphans existing rate-limit rows (they expire within 15 minutes). Do it in a quiet window.
8. **Table growth:** expired rows are removed opportunistically (about 1 % of recorded failures trigger a cleanup). If you ever want a hard bound, a daily `DELETE FROM login_attempts WHERE window_started_at < now() - interval '1 hour';` is safe.
9. **Open follow-up (app change, not in this branch):** log a startup warning in production when `TRUSTED_PROXY_HOPS` is `0`.

### 6. Backups & digest scheduling — `[HUMAN]` (units not enabled by this agent)

```bash
sudo cp deploy/systemd/fleetos-backup.* /etc/systemd/system/
sudo cp deploy/systemd/fleetos-email-digest.* /etc/systemd/system/
# Create /etc/fleetos/backup.env and /etc/fleetos/cron.env (mode 0600).
# Generate age keypair OFF the server; put only AGE_RECIPIENT (public) in backup.env.
# Keep age private key offline — document holders in the password manager vault.
sudo systemctl daemon-reload
sudo systemctl enable --now fleetos-backup.timer
sudo systemctl enable --now fleetos-email-digest.timer
```

Digest HTTP call (must match route):

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_BASE_URL/api/internal/email-digest"
```

### 7. Updates

1. Pull/tag new image (`FLEETOS_IMAGE_TAG`).
2. `docker compose … build app && docker compose … up -d` (migrate runs again safely).
3. Smoke-test login + one read path.

### 8. Rollback

1. Set `FLEETOS_IMAGE_TAG` to previous known-good tag; `up -d app`.
2. If data corruption: stop app, restore bundle with `scripts/backup/restore.sh` **only** after `--i-know-this-overwrites-production`, then start app.
3. Run `scripts/backup/verify-restore.sh` monthly on a throwaway DB (not production).

### 9. Before real customer data — checklist

**Verified locally (2026-10-30 throwaway Docker stack — not a VPS):**

- [x] `fleetos_app` not superuser / not bypassrls (local compose)
- [x] Attachments volume persistent across `down`/`up` + included in age backup bundle (byte-identical restore)
- [x] App reachable only through Caddy in compose (no published app/Postgres host ports)
- [x] Local forged `X-Forwarded-For` did not change IP `login_attempts` hash with `TRUSTED_PROXY_HOPS=1` (still **re-test on the real server**)
- [x] Privacy drafts under `docs/privacy/` (ROPA / breach / DSR / retention gaps) — **drafted, not legally approved**

**Still `[HUMAN]` / not verified on a real host:**

- [ ] LUKS/disk encryption decision recorded at VPS provision
- [ ] UFW + fail2ban + unattended-upgrades verified
- [ ] TLS cert issued for real `DOMAIN` (DNS + ACME)
- [ ] B2 / rclone account + offsite upload tested **or** accepted risk documented
- [ ] age key custody: public on server, private offline with named holders
- [ ] GitHub environment secrets / staging deploy gate
- [ ] First restore drill **on the VPS** (monthly `verify-restore.sh`)
- [ ] Forged-XFF test from a machine outside the VPS (see section above)
- [ ] Email provider DPA / DNS (SPF/DKIM) if digest enabled
- [ ] Break-glass admin recovery known to more than one person
- [ ] DPA / legal review of `docs/privacy/*` by the data controller
- [ ] `LOGIN_RATE_LIMIT_UNAVAILABLE` not present in logs after first real bring-up

Privacy drafts (pre-go-live reading): `docs/privacy/ROPA.md`, `BREACH_PROCEDURE.md`, `DATA_SUBJECT_REQUESTS.md`, `RETENTION_AND_GAPS.md`.

## Local verification (developer laptop)

See `docs/SESSION_NOTES_2026-10-30.md` and `docs/PLAN_STATUS_REVIEW.md`. Docker build/compose/backup drill can be run without the VPS; VPS steps remain `[HUMAN]`.
