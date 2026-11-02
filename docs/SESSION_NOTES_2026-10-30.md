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

(a) **StatusPill** foreground colours — **DECIDED 2026-11-02**: text-only tokens (`--success-text` / `--warning-text` / `--error-text`) for ≥4.5:1; fills unchanged (`cursor/vessel-read-pill-contrast`).  
(b) Vessel page read for `vessel_user` / `management_user` — **DECIDED 2026-11-02**: `vessels: read` (own vessel only); no vessel core write; notes stay `particulars: read` (no note write). `superintendent` / `read_only` remain `vessels: none` (owner may revisit).  
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

## Update — end of day (image hardening)

- Branch `cursor/image-hardening` committed locally: `955a2c0` (on top of prod-ready `edfd851`). Not pushed.
- Changes: Node base `22.23.4-bookworm-slim` (app + migrate), npm/npx/corepack stripped from app runtime, apt upgrade, Caddy `2.11.7-alpine`, Trivy gate `ignore-unfixed: true`, pinned actions (`trivy-action v0.36.0`, `checkout v4.4.0`, `setup-buildx v3.11.1` — tags confirmed to exist), empty `.trivyignore`, "Image update policy" in DEPLOY/RUNBOOK.
- Cursor-reported (not re-run by reviewer): Trivy 114H/9C -> 56H (all unfixed OS)/1C (CVE-2023-45853 zlib1g, unfixed); image 448 MB; tests 304 unit / 63 integration; both `npm audit` gates exit 0.
- Unverified by reviewer: Docker/Trivy runs, caddy 2.11.7 tag in registry.
- Open: Postgres 17.x minor bump (after backup); owner decisions (a)-(e) above; legal/privacy review; VPS human-only items.
- Push order: rls-phase1 -> deps-security -> rls-phase2 -> fix-access-500s -> auth-hardening -> indexes-and-cleanups -> pg-error-handling -> a11y-pass -> dev-deps-security -> prod-ready -> image-hardening.
