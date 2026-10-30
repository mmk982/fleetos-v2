# Accessibility audit — WCAG 2.1 AA

**Date:** 2026-10-30  
**Branch:** `cursor/a11y-pass` (uncommitted; no commit/push)  
**Scope:** English UI only. Arabic/RTL out of scope. No RLS / migrations / permissions / business-logic changes.

## Method

1. **Focus management (Part A):** Hand-rolled focus trap + dialog stack in `src/lib/a11y/*`, wired into `Drawer` / `Modal`. Unit tests: `focusable.test.ts`, `dialog-stack.test.ts` (happy-dom).
2. **Automated axe (Parts B/C):** `axe-core` (devDependency) injected via Playwright Chromium (`scripts/run-a11y-axe.mjs`). Tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice`.
3. **Users:** RLS-TEST accounts from `docs/RLS_BROWSER_TEST.md` — `rls-admin1@example.invalid` (default), `rls-vua@example.invalid` for monthly forms, logged-out for login.
4. **Matrix:** each page × `{light, dark}` × `{desktop 1280×800, mobile 390×844}` via `page.setViewportSize` + `document.documentElement.classList` / `localStorage.theme` (next-themes class strategy). **4 combinations** (not the old EN/AR × 8).
5. **Raw artifacts:** `docs/_a11y-axe-before.json`, `docs/_a11y-axe-after.json`.

### Pages scanned

login, dashboard, vessels list/detail, certificates list/detail/new, crew list/detail + drawer open, deficiencies list + drawer open, monthly forms (vuA), alerts, notifications, settings (company, users, system lists), confirm-delete modal open, mobile nav overlay (mobile combos only).

## Part A — focus trap (delivered)

| Requirement | Evidence |
|---|---|
| Tab / Shift+Tab cycle; 0/1 focusable; re-query on Tab | `src/lib/a11y/focusable.ts` + tests |
| Initial focus unchanged (Drawer → close; Modal → panel) | `useDialogA11y` + `initialFocusRef` |
| Return focus to opener | `openerRef` in `use-dialog-a11y.ts` |
| Page behind inert | `[data-app-shell]` + `dialog-stack.ts`; dialogs portal to `document.body` |
| Nested dialogs (top Escape / trap) | Stack in `dialog-stack.ts` |
| Nested cases found | `ConfirmDeleteButton` → `Modal`; `CrewCertificatesSection` → `Modal` (create/edit) + `ConfirmDeleteButton` (second Modal). List drawers do not currently host ConfirmDelete. |
| No new runtime dependency | `happy-dom`, `axe-core`, `playwright` are **devDependencies** only |

## Axe results — before → after (rule → page-combo hits)

| Rule | Before (page×combo hits) | After | Notes |
|---|---:|---:|---|
| `color-contrast` | 70 | **41** (node count 508) | `--text-muted` + accent/destructive button ink fixed; **status-pill brand colours remain** |
| `label` | 8 | **0** | `aria-label` on file inputs |
| `empty-table-header` | 8 | **0** | `sr-only` “Actions” on empty `<th>` |
| `definition-list` | 8 | **0** | Mobile card `<dl>` → `<div>` |
| `region` | 2 | **0** | Mobile nav wrapped in `<nav aria-label="Main navigation">` |

Node-level `color-contrast` counts: before **1028** → after first fix pass **557** (mostly StatusPill / brand tokens).

## Remaining contrast — owner decision (do not change palette without sign-off)

Computed from `globals.css` tokens (WCAG 2.1 AA normal text needs ≥ 4.5:1):

| Pair | Ratio | Verdict | Nearest existing step / impact |
|---|---:|---|---|
| `--text-muted` light `#94a3b8` on `#fff` | 2.56 | **Fixed** by stepping muted → tertiary `#64748b` (4.76) | Muted and tertiary now match in light |
| `--text-muted` dark `#64748b` on `#0f172a` | 3.75 | **Fixed** by stepping muted → tertiary `#94a3b8` (6.96) | Same |
| `--accent` dark `#60a5fa` + white button text | 2.54 | **Fixed** mechanistically: `dark:text-[var(--bg-page)]` on accent buttons | Slightly darker label on blue chips |
| `--error` dark `#fb7185` + white | 2.69 | **Fixed** on `Button` destructive the same way | — |
| `--success` `#059669` on tinted pill bg | ~3.35 | **FAIL — owner** | Darken success text toward `--text-primary` / deeper green; changes StatusPill look |
| `--warning` `#d97706` on tinted pill bg | ~2.89 | **FAIL — owner** | Same for warning/critical pills |
| `--error` `#e11d48` on tinted pill bg | ~3.7–4.12 | **FAIL — owner** (borderline / fails on tint) | Darken error text on light tints |

**Decision text for owner:** Keep brand StatusPill colours as-is (fail AA on tinted fills) **or** approve darker pill foregrounds (recommend `--text-primary` or a dedicated `--tone-*-fg` step ≥ 4.5:1 on the tint). Visual impact: pills read heavier / less “pastel brand”.

## Manual checks (representative subset)

Performed on login, vessels list, crew drawer (keyboard + spot measures). Combinations exercised via theme class + viewport resize in Playwright / browser.

| Check | Result |
|---|---|
| Keyboard: actions reachable, visible focus | Pass after `focus-visible` outline on `Button`; forms already use focus ring |
| No keyboard trap outside dialogs | Pass (trap only while dialog open) |
| Skip link / landmarks | Skip link added in `dashboard/layout.tsx`; `aside`/`nav`/`main` present |
| Form labels / `aria-invalid` | File inputs labelled; full form error-association not exhaustively audited |
| StatusPill meaning not colour-only | Pass — text labels via `STATUS_LABELS` / children |
| Touch targets (mobile) | Many ghost/icon controls use `h-7`/`h-9` (28–36px). **Below 44px** handoff target for primary mobile actions; some below **24×24** WCAG 2.2 minimum unlikely for buttons, icon-only `h-7 w-7` avatar chip is 28px. Report: tighten mobile hit areas in a follow-up. |
| Zoom 200% / text-spacing | Spot-checked login + list — no clipped primary content observed; **CANNOT VERIFY** every page |
| `prefers-reduced-motion` | Added global reduce rule in `globals.css` |
| Page `<title>` | Root / dashboard metadata present; many child routes inherit “FleetOS — Dashboard” only — improve per-route titles later |
| One `<h1>` / heading order | List/detail pages generally one `h1`; **no full screen-reader pass** |

## Known limits

- Automated axe finds only a subset of WCAG issues.
- **No VoiceOver / NVDA / JAWS run** in this pass.
- Tablet band and RTL not in matrix.
- `@drawer` intercepting routes **not implemented** (see recommendation below).

## Part D — `@drawer` recommendation

**Recommend: SUPERSEDE.** Sixteen modules already ship drawer UX via `*-drawer.tsx` components on `/new` and `/[id]/edit` pages. Vessel add/edit is admin-only. Intercepting/parallel routes add hard-refresh edge cases, close-semantics complexity the plan already flags, and route-folder overhead for little user-facing gain beyond URL consistency with an already-solved drawer pattern. Implement later only if deep-linking “list + open drawer” without a full navigation becomes a hard product requirement.
