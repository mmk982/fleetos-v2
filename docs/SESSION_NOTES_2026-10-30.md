# Session notes — 2026-10-30 (`cursor/prod-ready`)

## Branch chain

1. `cursor/a11y-pass` — focus trap, axe matrix, mechanical a11y
2. `cursor/dev-deps-security` — vitest 5 / happy-dom 21 / playwright / uuid override; dual npm audit green; migrations **0025–0029**
3. `cursor/prod-ready` — cut from `dev-deps-security`, merge `cursor/prod-stack` (**uncommitted** merge of `87284fa` / `707e6d6`)

Do **not** commit/push from this session unless Eng.MHD asks.

## Migrations 0025–0029 (purpose)

| Migration | Purpose |
| --- | --- |
| 0025 | RLS phase 1 (certificates, crew*, access_logs) |
| 0026 | RLS phase 2 (remaining vessel-scoped tables + notifications) |
| 0027 | Access-path / 500-hardening related schema (as on deps chain) |
| 0028 | FK indexes / related |
| 0029 | `login_attempts` (DB-backed login limiter) |

Next schema change number: **0030** (e.g. Arabic/RTL if revived).

## Decisions made this session

- Keep **this chain’s** deps/tests/schema/app; take prod-stack **Docker/Caddy/backup/systemd/deploy docs**
- CI: dual `npm audit` **and** Trivy (pinned actions); no duplicate gates
- Compose: do **not** `env_file` full `.env.production` into `app`/`caddy` (owner secrets leak) — fixed
- `TRUSTED_PROXY_HOPS` default **1** in compose; production warn when `0`
- Map Postgres `42501` → `ForbiddenError` inside `withDb` / `withSystemDb` path (`runWithClient`)
- Privacy docs = **drafts only**; legal framework **unknown**
- `restore.sh` creates `fleetos_app` role if missing (throwaway restore DBs)

## Open owner decisions (do not decide here)

(a) **StatusPill** foreground colours fail AA (≈2.9–4.1) — darken or document exception  
(b) Should `vessel_user` / `management_user` see their own vessel page (`vessels: none` today)? Should vessel users write vessel notes (`particulars` read-only for them)?  
(c) Arabic/RTL removal postponed (spec in local prompt); next migration **0030**  
(d) Login-limiter IP backoff on shared NAT — keep, raise ceiling, or soften  
(e) Push/merge order; `master` ~78 commits ahead of `origin` — Eng.MHD chooses rebase/merge strategy  

## Local Docker proof (summary)

- Image `fleetos:local` ~436MB; non-root `uid=10001`; argon2 glibc prebuild present; no vitest/playwright/axe/happy-dom in runtime
- Compose: migrate exit 0 through migration ids 1–30 (0000–0029); 25 RLS tables; smoke login/vessel/cert/attachment; XFF forge → single IP hash; age backup + restore attachments checksum match; corrupt checksum fails; restore refuses live URL without flag
- Trivy image (local): HIGH/CRITICAL present (OS + nested npm) — CI job is the release gate
- Stack torn down with `down -v`; throwaway env/keys deleted

## Tips

- Always pass `--env-file .env.production` to compose commands after removing `env_file` from `app`
- Bootstrap admin: override migrate entrypoint; use **owner** `DATABASE_URL`; do not print passwords
- Local Caddy: `DOMAIN=http://localhost` (plain HTTP, no ACME)
