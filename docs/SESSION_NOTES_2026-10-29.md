# Session notes — 2026-10-29 (handoff for the next session)

State at the end of the day. Facts below were checked in the repo during the session unless marked *(from Cursor report, not re-run)*.

## Branches (each builds on the previous one)

| Branch | Tip | Content |
|---|---|---|
| `cursor/rbac-enforcement` | `ab4c1ca` | plan-vs-code review (`docs/PLAN_STATUS_REVIEW.md`) + checkbox sync; already on origin |
| `cursor/rls-phase1` | `65de95c` | RLS phase 1 (certificates, crew, access_logs): migration `0025`, `fleetos_app` role, `withDb`/`withSystemDb`, integration tests, no-vessel notice, read-only UI gating |
| `cursor/deps-security` | `b09abf5` | `next` 16.4.3, `zod` 4.6.6, transitive fixes; `npm audit --omit=dev --audit-level=high` exit 0 (2 moderate `exceljs`→`uuid` left on purpose) |
| `cursor/rls-phase2` | `b5c1095` | RLS phase 2 (20 more tables): migration `0026`, callers moved to `withDb` |
| `cursor/fix-access-500s` | this branch | no HTTP 500 for restricted roles (monthly forms for `submit` roles, vessel pages, no-vessel notices) |
| `cursor/prod-stack` | `87284fa` | **WIP, not reviewed**: Dockerfile, `docker-compose.prod.yml`, Caddyfile, backup/restore scripts, systemd units, `docs/DEPLOY.md`, CI audit/Trivy. Branched from `cursor/rls-phase1`; needs rebase onto the chain before merging |

Nothing has been merged into `master`. Merge order when ready: rls-phase1 → deps-security → rls-phase2 → fix-access-500s, then rebase/merge prod-stack.

## Decisions made

- **Arabic UI: not required, postponed.** Remove-Arabic task (font, RTL CSS, `dir="auto"`, `users.preferred_locale` via a migration, docs) is fully specified in `cursor-prompt-remove-arabic.md` (untracked, locally ignored). `PROJECT_REVIEW_2026-10-28.md` stays untouched. The migration number will clash with `0026`/`0027` — renumber at merge.
- **RLS is wanted as a second defence layer.** Real company data will be entered during the sponsor's trial, so backup/restore and the production stack are required before real data (nothing is deployed yet; deployment waits until the app basics are finished).
- **Not decided (owner):** should `vessel_user` / `management_user` see their own vessel's page (matrix currently `vessels: none` → they get an access-denied notice)? Should vessel users write vessel notes (`particulars` is read-only for them)?

## Verified today

- Policies in `0026` match `MODULE_PERMISSIONS` write rights per module.
- Every file touching phase-2 tables uses `withDb`/`withSystemDb` (static grep; the one hit, `activity-log/write.ts`, matched a comment only).
- `npm audit --omit=dev --audit-level=high` exit 0 on the deps branch; lockfile diff = 25 version changes, no major bumps.
- Test counts reported by Cursor *(not re-run by the assistant)*: vitest 219, integration 26, `tsc`/`eslint`/`db:check`/`next build --webpack` exit 0.

## Open work, in priority order

1. Tests for `session.ts`, `login-rate-limit.ts`, `request-guard.ts` — then move the login rate limiter from in-memory to the database (currently resets on restart).
2. Missing foreign-key indexes (one migration).
3. Small items: dashboard pending-forms month uses server date instead of company day; `dateFormat` setting unused (delete or implement); split `certificate.controller.ts` (only after 1 has tests).
4. RLS phase 3 candidates: `vessels` for scoped roles, `activity_logs`.
5. `@drawer` routes and a formal WCAG pass.
6. Before real data: review/merge `cursor/prod-stack`, run one restore drill, write ROPA + breach-notification docs (nothing exists in `docs/` for these), configure CI audit/Trivy.

## Known leftovers

- RLS-TEST users/vessels/records remain in the local dev database (ids in `docs/RLS_BROWSER_TEST.md`).
- `NOTIFICATION_SYNC_FAILED` is logged for a scoped user with no vessel (page still renders).
- Local `.git/info/exclude` ignores `cursor-prompt-*.md` (prompt files are not part of the repo).
- `master` is 78 commits ahead of origin/master — unrelated to this chain; check before merging anything.
