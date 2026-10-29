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

- [ ] LUKS/disk encryption decision recorded
- [ ] UFW + fail2ban + unattended-upgrades verified
- [ ] TLS cert issued for real `DOMAIN`
- [ ] `fleetos_app` not superuser / not bypassrls
- [ ] Attachments volume persistent + included in backup
- [ ] age public key on server; private key offline with named holders
- [ ] Offsite rclone remote tested **or** accepted risk documented
- [ ] One successful `verify-restore.sh` drill logged
- [ ] Email provider DPA / DNS (SPF/DKIM) if digest enabled
- [ ] Break-glass admin recovery known to more than one person

## Local verification (developer laptop)

See verification section in `docs/PLAN_STATUS_REVIEW.md` (prod-stack append). Docker build/compose/backup drill can be run without the VPS; VPS steps remain `[HUMAN]` / **CANNOT VERIFY** from this agent.
