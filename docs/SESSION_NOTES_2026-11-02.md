# Session notes — 2026-11-02

## State
- Branch chain tip: `cursor/vessel-read-fleet-roles` (`3130253`) <- `cursor/vessel-read-pill-contrast` (`2844335`) <- `cursor/image-hardening` (`4d056ed`, CI #74 green on GitHub).
- Pushed by owner earlier today: indexes-and-cleanups, a11y-pass, prod-ready, image-hardening (CI green). `prod-stack` red CI is irrelevant (merged into prod-ready; can be deleted).
- NOT yet pushed: `vessel-read-pill-contrast`, `vessel-read-fleet-roles` (`git push -u origin <branch>`).

## Done today
- CI Trivy fs gate failed on `backend/composer.lock` (17) and stale `pnpm-lock.yaml` (26, next 16.2.4). Removed both (owner decision) -> CI green. README states npm is the only lockfile. `pnpm-workspace.yaml` left untouched.
- Vessel read access: `vessel_user`/`management_user` read own vessel only; `superintendent`/`read_only` read fleet-wide; writes admin only; notes permissions unchanged. `vessels` table is NOT under RLS (app-layer scope only).
- StatusPill text tokens (`--success-text` #047857, `--warning-text` #b45309, `--error-text` #be123c) reach >=4.5:1 in light theme (warning ~4.55 by oklab, thin margin); dark unchanged. Axe not run (Playwright Chromium missing) — only vitest covers contrast.
- Tests (Cursor-reported, not re-run by reviewer): 332 unit / 63 integration; audits exit 0.

## Owner decisions recorded
- Single-tenant per deployment: no cross-org isolation needed.
- Login limiter: keep 5/account, 40/IP per 15 min; watch `LOGIN_RATE_LIMIT_*` during trial; adjust only if legit users get locked (open question: shared office IP?).
- Postgres 17.4 -> 17.x bump: defer to the server, after backup.
- Arabic/RTL removal: CANCELLED (2026-11-03). Keep the Arabic/RTL code and `preferred_locale` in case Arabic is wanted later; no migration for it. Next migration number is 0031.
- RLS for `vessels` done on `cursor/rls-vessels` (migration 0030, 26 RLS tables).

## Local housekeeping
- Delete untracked `C:\fleetos-v2\backend` (leftover `vendor/`, slow to remove from sandbox): `Remove-Item -Recurse -Force C:\fleetos-v2\backend`. Keep `eslint.config.mjs` unmodified.
- Close `next dev`, then `rm -rf .next` before any production build.

## Next options
1. Optional RLS for `vessels` (new migration ~0030).
2. (cancelled) Arabic/RTL removal.
3. Before real data: review `docs/privacy/*` drafts (legal framework undecided) + human-only server items (VPS, DNS/TLS, B2/rclone, age key custody, GitHub env secrets, email DPA, forged-XFF test with `TRUSTED_PROXY_HOPS=1`, first restore drill).
4. Merge strategy: one PR from the chain tip to `master`; local `master` is 78 commits ahead of `origin/master` — decide how to handle first.
