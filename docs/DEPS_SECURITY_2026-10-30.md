# Dependency security pass — 2026-10-30

**Branch:** `cursor/dev-deps-security` (from `cursor/a11y-pass`). No commit/push in this session.

## Goals

| Check | Result |
|---|---|
| `npm audit --omit=dev --audit-level=high` | **exit 0** |
| `npm audit --audit-level=high` | **exit 0** |
| Full `npm audit` (any severity) | exit 1 — residual **moderate** only (see below) |

## `exceljs` → `uuid` decision

- `exceljs@4.4.0` declares `uuid@^8.3.0`. Source uses **`v4()` only** (conditional-formatting x14 ids), never `v3`/`v5`/`v6` with a `buf` argument (the GHSA-w5hq-g745-h8pq surface).
- Do **not** apply npm’s suggested `exceljs@3.4.0` downgrade.
- `package.json` `overrides.uuid = "11.1.1"` forces the patched release for the exceljs tree. Verified: `npm ls uuid` shows `uuid@11.1.1 overridden`; `exportToExcel` / `Workbook.xlsx.writeBuffer()` still produce a valid ZIP (`PK…`) buffer (unit smoke + authenticated `/api/export/certificates?format=xlsx` → 200).

## Residual (moderate, accepted)

- Nested `esbuild@≤0.24.2` under `drizzle-kit` → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` (GHSA-67mh-4wv8-2f99). npm’s non-force path cannot patch it; `--force` would install `drizzle-kit@0.18.1` (breaking). Revisit when drizzle-kit drops `@esbuild-kit`.

## CI note

`.github/workflows/ci.yml` on this branch now runs both:

- `npm audit --omit=dev --audit-level=high`
- `npm audit --audit-level=high`

and pins Node to **22.12** (Vitest 5 requirement). When merging with `cursor/prod-stack`, keep the **full** high audit as well as omit=dev.
