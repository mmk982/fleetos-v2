# Design System Implementation Plan (MASTER_PLAN.md Phase 1)

> **For agentic workers:** this plan is split into tasks with checkboxes (`- [ ]`). Work one task at a time; each ends in a visually-verifiable deliverable (not a pytest-style unit test — this is a frontend/design task, so "done" means "matches the named DESIGN_HANDOFF.md rule when checked in the browser at the stated breakpoints/themes/locales").

**Goal:** Implement `DESIGN_HANDOFF.md` in code — tokens, the 5-group shell (sidebar + top bar), shared list/drawer/modal primitives — and apply it to three reference surfaces (Login, the dashboard shell, and the Vessels module), matching `MASTER_PLAN.md` Phase 1's own scope ("applied to the shell, login screen, and Vessels pages as the reference implementation").

**Architecture:** Add a CSS custom-property token layer + Tailwind v4 class-based dark mode to `src/app/globals.css`; wire `next-themes` for persisted light/dark; scaffold (not fully translate) an EN/AR locale toggle with `dir="rtl"` and the mandatory LTR-isolate rule for identifiers; build shared layout components (`Sidebar`, `TopBar`, mobile overlay nav) and shared UI primitives (`StatusPill`, `Drawer`, `Modal`/`BottomSheet`, `ListToolbar`, `Identifier`); retrofit the existing Vessels module and a new Login route onto these primitives. The remaining 12 modules are explicitly out of scope for this plan (Task 10 hands that off as a repeatable, delegatable follow-on).

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2.4, Tailwind CSS v4 (`@tailwindcss/postcss`), Drizzle ORM + better-sqlite3, TypeScript 5, Zod 4. `next-themes` is a **new** dependency this plan adds (not currently in `package.json`).

## Global Constraints

(Copied verbatim/paraphrased from `DESIGN_HANDOFF.md` and project docs — every task below implicitly inherits these.)

- Next.js 16 has breaking changes vs. training-data assumptions (`AGENTS.md`) — before writing any App Router routing code (especially Task 8's intercepting routes), read the relevant guide in `node_modules/next/dist/docs/` first. Do not assume Next 13/14-era syntax still applies without checking.
- Exactly 5 sidebar groups, always rendered in full, never collapsed: OVERVIEW, FLEET, COMPLIANCE, DOCUMENTS, SETTINGS (`DESIGN_HANDOFF.md` §2.1). Settings renders last in the DOM/visual order even though it's the 4th listed group.
- Two independent toggles — theme (light/dark) and locale (EN/AR) — must never be coupled; all 4 combinations (light+EN, dark+EN, light+AR, dark+AR) must render correctly (§5).
- Identifiers (vessel names, IMO numbers, certificate/policy numbers, file names) are always wrapped `direction: ltr; unicode-bidi: isolate`, even embedded in Arabic/RTL text — this regressed once already during design and must not regress again in code (§5, §3).
- Desktop breakpoint is ≥768px (docked sidebar); below 768px is hamburger + full-screen overlay nav, not a slide-out drawer (§2.2).
- Status pills communicate meaning through color **and** text label, never color alone; minimum 44px tap target on mobile for every interactive element (§6).
- `--accent` (`#378ADD`) is the only primary-action/link color in both themes; status colors (success/warning/danger triads in §1.3) are semantic and never reused for anything else.
- Desktop add/edit forms are a 360–380px trailing-edge side drawer over a dimmed backdrop showing the full page behind it; mobile add/edit is a full-screen sheet, not a shrunk drawer (§4.1, §4.3).

## Two-tool workflow

This plan is written to be split across **Claude Code** (this agent, or a `claude` CLI session with repo access) and **Cursor** (Eng.MHD's IDE). Rationale, not just an arbitrary split:

- **Claude Code drives Tasks 0–5 and Task 10** — foundational/shared-primitive work and the 12-module propagation. These are exactly the "same pattern, many files, must stay consistent" jobs an agentic multi-file pass handles better than screen-by-screen IDE editing: one wrong token name in `globals.css` or one Sidebar prop shape has to be right everywhere at once.
- **Cursor drives Tasks 6–9** — the two reference screens (Login, Vessels) plus the visual QA pass. This is one-screen-at-a-time, look-at-it-live, pixel-fit-against-the-mockup work, which is what an IDE with instant preview is better suited for than an agent working blind from a markdown spec.
- **Git model:** commit the current uncommitted work first (Task 0), then branch `design-system-phase-1` off `master` for everything in this plan. Both tools commit directly to that branch in small, scoped commits (one task ≈ one or a few commits); Eng.MHD reviews the diff and merges to `master` when Task 9's QA pass is clean. Don't run Claude Code and Cursor on the same uncommitted files at the same time — hand off task-by-task, not file-by-file simultaneously, to avoid merge conflicts on `globals.css` and the shared primitives.

---

### Task 0: Repo hygiene — commit outstanding work, stop the line-ending churn

**Why this is Task 0, not optional cleanup:** `git status` currently shows 22 tracked files modified plus `DESIGN_HANDOFF.md` untracked. Checked the actual diffs — `PROJECT_PLAN.md`'s diff is genuine content (+514/−20 lines, the Fleet OS 2 scope and review-round edits from this session); the other 22 files (everything under `src/`, plus `drizzle.config.ts` and `scripts/migrate.ts`) have a diff where insertions ≈ deletions per file and `file src/modules/vessels/vessel.model.ts` reports **CRLF line terminators**, while the git history's blobs are LF. That's a pure line-ending flip, not a code change — but if it's left uncommitted, every future Claude Code / Cursor diff on these files will be swamped with whitespace noise, and the two tools may keep re-flipping each other's line endings back and forth if their editors don't agree on `core.autocrlf`.

**Files:**
- Create: `.gitattributes` (repo root)
- Modify: none (the CRLF fix is a re-checkout, not hand-editing 22 files)

- [ ] **Step 1: Add `.gitattributes` to force LF for text files**

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.ico binary
```

- [ ] **Step 2: Normalize existing line endings and stage everything**

```bash
git add --renormalize .
git status --short
```
Expected: the 22 previously-CRLF files show as modified (now LF), nothing shows as CRLF anymore.

- [ ] **Step 3: Commit the pending design docs and the normalization separately**

```bash
git add PROJECT_PLAN.md DESIGN_HANDOFF.md
git commit -m "docs: add DESIGN_HANDOFF.md, finalize Fleet OS 2 scope in PROJECT_PLAN.md"
git add -A
git commit -m "chore: normalize line endings to LF via .gitattributes"
git push origin master
```

- [ ] **Step 4: Create the working branch for this plan**

```bash
git checkout -b design-system-phase-1
git push -u origin design-system-phase-1
```

---

### Task 1: Tailwind v4 token layer + class-based dark mode

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: CSS custom properties (`--bg-page`, `--bg-sidebar`, `--border`, `--bg-card`, `--accent`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`, plus `--status-success-bg/-text`, `--status-warning-bg/-text`, `--status-danger-bg/-text`) and matching Tailwind utility classes (`bg-page`, `bg-sidebar`, `border-default`, `bg-card`, `text-primary`, `text-secondary`, `text-tertiary`, `text-muted`) that every later task consumes. Dark mode is opt-in via a `.dark` class on `<html>`, driven by `next-themes` (Task 2) — not `prefers-color-scheme`.

- [ ] **Step 1: Replace the starter tokens with the DESIGN_HANDOFF.md palette**

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --bg-page: #F8FAFC;
  --bg-sidebar: #123A63;
  --border: #E2E8F0;
  --bg-card: #FFFFFF;
  --accent: #378ADD;
  --text-primary: #0F172A;
  --text-secondary: #334155;
  --text-tertiary: #64748B;
  --text-muted: #94A3B8;

  --status-success-bg: #EAF3DE;
  --status-success-text: #27500A;
  --status-warning-bg: #FAEEDA;
  --status-warning-text: #633806;
  --status-danger-bg: #FCEBEB;
  --status-danger-text: #791F1F;
}

.dark {
  --bg-page: #0B1526;
  --bg-sidebar: #0A1220;
  --border: #1E2C45;
  --bg-card: #101B30;
  --accent: #378ADD;
  --text-primary: #F1F5F9;
  --text-secondary: #CBD5E1;
  --text-tertiary: #8FA3C0;
  --text-muted: #5B729B;

  --status-success-bg: #085041;
  --status-success-text: #5DCAA5;
  --status-warning-bg: #633806;
  --status-warning-text: #FAC775;
  --status-danger-bg: #791F1F;
  --status-danger-text: #F09595;
}

@theme inline {
  --color-page: var(--bg-page);
  --color-sidebar: var(--bg-sidebar);
  --color-border-default: var(--border);
  --color-card: var(--bg-card);
  --color-accent: var(--accent);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-muted: var(--text-muted);
  --font-sans: var(--font-inter);
  --font-mono: var(--font-geist-mono);
  --font-arabic: "IBM Plex Sans Arabic", var(--font-inter), sans-serif;
}

body {
  background: var(--bg-page);
  color: var(--text-primary);
}
```

Note: the light-mode sidebar (`--bg-sidebar: #123A63`) is intentionally a different color family from `--bg-page` — per §1.2 this is a deep-blue sidebar in light mode, not gray. Don't "fix" this into matching the page background.

**Correction (caught in Cursor's independent review of this plan):** the token block above now uses `--font-inter` — an earlier version of this task kept the starter app's `Geist`/`Geist_Mono` fonts in `--font-sans`, which contradicts `DESIGN_HANDOFF.md` §1.4 (`--font-latin: Inter, sans-serif`) and `PROJECT_PLAN.md` §14a (both explicitly specify Inter for Latin text, paired with an Arabic font for `dir="rtl"`). Task 2's font import changes accordingly, below.

- [ ] **Step 2: Verify tokens compile**

Run: `npm run dev`, open `/`, open devtools → Elements → confirm `--bg-page` etc. are computed on `<body>`. No visual check needed yet since no component consumes the new utility classes until Task 4+.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design-system): add DESIGN_HANDOFF.md token layer + class dark mode"
```

---

### Task 2: next-themes wiring + theme toggle

**Files:**
- Modify: `package.json` (add dependency), `src/app/layout.tsx`
- Create: `src/components/theme-toggle.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `<ThemeProvider>` wrapping the app (attribute `class`, `defaultTheme="light"`, `enableSystem={false}` — per Global Constraints, theme and locale are independent and neither should silently follow OS/browser settings for this internal fleet-office tool); `<ThemeToggle />` component other tasks (TopBar, Task 4) import and render.

- [ ] **Step 1: Install next-themes**

```bash
npm install next-themes
```

- [ ] **Step 2: Wrap the root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// Inter per DESIGN_HANDOFF.md §1.4 / PROJECT_PLAN.md §14a — not Geist (the
// create-next-app starter default). Geist_Mono is kept for --font-mono only;
// neither spec document requires a specific mono font.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FleetOS",
  description: "Fleet compliance management",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

`suppressHydrationWarning` on `<html>` is required by next-themes (it sets the `class` attribute client-side before hydration).

- [ ] **Step 3: Build the toggle component**

```tsx
// src/components/theme-toggle.tsx
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-8 w-8" aria-hidden="true" />;
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-11 w-11 items-center justify-center rounded-md text-text-tertiary hover:bg-card md:h-8 md:w-8"
    >
      {isDark ? "☀" : "🌙"}
    </button>
  );
}
```

The `h-11 w-11` on mobile / `md:h-8 md:w-8` on desktop satisfies the 44px mobile tap-target rule (§6) without inflating the desktop top-bar icon.

- [ ] **Step 4: Verify**

Run `npm run dev`, open `/`, click the (not-yet-placed) toggle isn't wired to any UI yet — instead temporarily render `<ThemeToggle />` in `src/app/page.tsx`, confirm clicking flips `<html class="dark">` in devtools and the page background changes color (proves Task 1's tokens are live). Remove the temporary render before committing.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx src/components/theme-toggle.tsx
git commit -m "feat(design-system): wire next-themes, add ThemeToggle"
```

---

### Task 3: Locale/RTL scaffold + LTR-isolate `Identifier` primitive

Scope note: this task builds the **mechanism** (locale toggle, `dir="rtl"`, font swap, the identifier-isolation primitive) — it does not translate all UI strings into Arabic. Per `DESIGN_HANDOFF.md` §5, full i18n architecture and persistence (`preferredLocale` on the user row + cookie fallback) is a documented follow-up referencing `PROJECT_PLAN.md` §14a/§14b; wiring that persistence layer needs the auth/users table from `MASTER_PLAN.md` Phase 3, which doesn't exist yet. This task only needs to prove the *toggle mechanism* and the *identifier rule* work, using a client-only cookie/state stand-in.

**Files:**
- Create: `src/components/locale-toggle.tsx`, `src/components/ui/identifier.tsx`
- Modify: `src/app/layout.tsx` (read a `locale` value and set `dir`/`lang` on `<html>`)

**Interfaces:**
- Produces: `<Identifier>{children}</Identifier>` — a `<span>` wrapper with `style={{ direction: "ltr", unicodeBidi: "isolate" }}`. Every later task that renders a vessel name, IMO number, certificate/policy number, or file name **must** wrap it in `<Identifier>`, per the Global Constraints rule.

- [ ] **Step 1: Build the `Identifier` primitive**

```tsx
// src/components/ui/identifier.tsx
export function Identifier({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Build a minimal client-side locale toggle (stand-in, not the final persisted architecture)**

```tsx
// src/components/locale-toggle.tsx
"use client";

import { useRouter } from "next/navigation";

const LOCALE_COOKIE = "fleetos-locale";

export function LocaleToggle({ current }: { current: "en" | "ar" }) {
  const router = useRouter();

  function setLocale(next: "en" | "ar") {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 text-sm" role="group" aria-label="Language">
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={current === "en"}
        className={`h-11 rounded-md px-2 md:h-8 ${current === "en" ? "font-semibold text-text-primary" : "text-text-tertiary"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("ar")}
        aria-pressed={current === "ar"}
        className={`h-11 rounded-md px-2 md:h-8 ${current === "ar" ? "font-semibold text-text-primary" : "text-text-tertiary"}`}
      >
        AR
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Read the cookie in the root layout and set `dir`/`lang`/font**

```tsx
// src/app/layout.tsx (add near the top)
import { cookies } from "next/headers";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("fleetos-locale")?.value === "ar" ? "ar" : "en";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased ${locale === "ar" ? "font-arabic" : "font-sans"}`}
    >
      {/* ...ThemeProvider + body as in Task 2... */}
    </html>
  );
}
```

Verify against `node_modules/next/dist/docs/` that `cookies()` is still async/awaited this way in Next 16.2.4 before relying on this snippet — this is exactly the kind of API surface `AGENTS.md` warns may have changed.

- [ ] **Step 4: Verify manually**

`npm run dev`, click AR, confirm `<html dir="rtl" lang="ar">` and the page mirrors (any container using `ms-*`/`me-*`/`ps-*`/`pe-*` logical properties will flip; anything still using `ml-*`/`mr-*` won't — flag any found during Task 7/8 review, don't silently leave physical-direction classes in place).

- [ ] **Step 5: Commit**

```bash
git add src/components/locale-toggle.tsx src/components/ui/identifier.tsx src/app/layout.tsx
git commit -m "feat(design-system): scaffold locale/RTL toggle + Identifier LTR-isolate primitive"
```

---

### Task 4: Shared layout primitives — Sidebar, TopBar, mobile nav overlay

**Files:**
- Modify: `src/components/dashboard-sidebar.tsx` (rewrite), `src/app/dashboard/layout.tsx`
- Create: `src/components/layout/top-bar.tsx`, `src/components/layout/mobile-nav-overlay.tsx`

**Interfaces:**
- Consumes: `ThemeToggle` (Task 2), `LocaleToggle` (Task 3).
- Produces: `<DashboardSidebar />` (desktop, ≥768px, always 5 groups per §2.1), `<TopBar companyName={string} />`, `<MobileNavOverlay open={boolean} onClose={() => void} />`. Module route pages (Task 7+) don't touch these directly — they're mounted once in `src/app/dashboard/layout.tsx`.

- [ ] **Step 1: Rewrite the sidebar with the full 5-group structure**

```tsx
// src/components/dashboard-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

// Order matches DESIGN_HANDOFF.md §2.1 source order: OVERVIEW, FLEET, COMPLIANCE, DOCUMENTS, SETTINGS.
const NAV_GROUPS: NavGroup[] = [
  { label: "OVERVIEW", items: [{ href: "/dashboard", label: "Dashboard" }] },
  {
    label: "FLEET",
    items: [
      { href: "/dashboard/vessels", label: "Vessels" },
      { href: "/dashboard/crew", label: "Crew" },
      { href: "/dashboard/particulars", label: "Particulars" },
    ],
  },
  {
    label: "COMPLIANCE",
    items: [
      { href: "/dashboard/certificates", label: "Certificates" },
      { href: "/dashboard/deficiencies", label: "Deficiencies" },
      { href: "/dashboard/insurance", label: "Insurance" },
      { href: "/dashboard/alerts", label: "Alerts" },
      // PSC (stub — PROJECT_PLAN.md §7b, DESIGN_HANDOFF.md §2.1). Missing
      // from this array in an earlier version despite the decision to nest
      // it under COMPLIANCE; caught in Cursor's round-3 review, since this
      // NAV_GROUPS array (not the prose spec) is what an implementing agent
      // actually copies.
      { href: "/dashboard/psc", label: "PSC" },
    ],
  },
  {
    label: "DOCUMENTS",
    items: [
      { href: "/dashboard/manuals", label: "Manuals" },
      { href: "/dashboard/ism-templates", label: "ISM Templates" },
      { href: "/dashboard/monthly-forms", label: "Monthly Forms" },
      { href: "/dashboard/drawings", label: "Drawings" },
      { href: "/dashboard/reminders", label: "Reminders" },
    ],
  },
  { label: "SETTINGS", items: [{ href: "/dashboard/settings", label: "Settings" }] },
];

function navItemIsActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/dashboard/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden h-full w-[220px] shrink-0 flex-col bg-sidebar md:flex"
      aria-label="Main navigation"
    >
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-white">
          FleetOS
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-text-muted">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ href, label }) => {
                const active = navItemIsActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors ${
                      active ? "bg-card text-text-primary border-s-2 border-accent" : "hover:bg-white/[0.08]"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

Note the active-item classes use logical `border-s-2` (start-edge), not `border-l-2` — this is what makes the active indicator mirror correctly in RTL per §2.1 ("a true mirror, not just repositioned").

- [ ] **Step 2: Build the TopBar**

```tsx
// src/components/layout/top-bar.tsx
"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { MobileNavOverlay } from "@/components/layout/mobile-nav-overlay";

export function TopBar({ locale, companyName }: { locale: "en" | "ar"; companyName: string }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-default bg-card px-4 md:h-14">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            className="flex h-11 w-11 items-center justify-center rounded-md md:hidden"
          >
            ☰
          </button>
          <span className="text-sm font-medium text-text-primary md:hidden">{companyName}</span>
          <span className="hidden text-sm font-medium text-text-primary md:inline">{companyName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Date — present per DESIGN_HANDOFF.md §2.1's top-bar spec (company name, then date, then
              the two toggles, bell, avatar); an earlier version of this component omitted it, caught
              in Cursor's independent review. Desktop only, per the mockups this section references. */}
          <span className="hidden text-sm text-text-tertiary md:inline" suppressHydrationWarning>
            {new Date().toLocaleDateString(locale === "ar" ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <LocaleToggle current={locale} />
          <ThemeToggle />
          <button type="button" aria-label="Notifications" className="flex h-11 w-11 items-center justify-center rounded-md md:h-8 md:w-8">
            🔔
          </button>
          <div className="h-7 w-7 rounded-full bg-accent" aria-hidden="true" />
        </div>
      </header>
      <MobileNavOverlay open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </>
  );
}
```

- [ ] **Step 3: Build the mobile full-screen overlay nav**

Per §2.2 this is a full-screen overlay replacing the top bar, not a slide-out drawer — reuse the same `NAV_GROUPS` data as the sidebar so the two never drift apart. Export `NAV_GROUPS` from `dashboard-sidebar.tsx` and import it here.

```tsx
// src/components/layout/mobile-nav-overlay.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/components/dashboard-sidebar";

export function MobileNavOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-sidebar md:hidden">
      <div className="flex h-[52px] shrink-0 items-center justify-between px-4">
        <button type="button" onClick={onClose} aria-label="Close navigation menu" className="flex h-11 w-11 items-center justify-center text-white">
          ✕
        </button>
        <span className="text-sm font-medium text-white">FleetOS</span>
        <div className="h-11 w-11" aria-hidden="true" />
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2 pb-1 text-[11px] font-medium tracking-wide text-text-muted">{group.label}</div>
            {group.items.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`block rounded-md px-3 py-3 text-sm font-medium ${
                  pathname === href ? "bg-white/[0.08] text-white" : "text-white/80"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Export `NAV_GROUPS` from the sidebar file**

Add `export` to the `NAV_GROUPS` declaration from Step 1 (it's written as a plain `const` above — change to `export const NAV_GROUPS: NavGroup[] = [...]`).

- [ ] **Step 5: Wire both into the dashboard layout**

```tsx
// src/app/dashboard/layout.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { TopBar } from "@/components/layout/top-bar";

export const metadata: Metadata = { title: "FleetOS — Dashboard" };

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("fleetos-locale")?.value === "ar" ? "ar" : "en";

  return (
    <div className="flex min-h-full flex-1 bg-page">
      <DashboardSidebar />
      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <TopBar locale={locale} companyName="FleetOS" />
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify across all 4 combinations**

`npm run dev`, open `/dashboard`, check: (a) light+EN, (b) dark+EN via ThemeToggle, (c) light+AR via LocaleToggle — confirm sidebar switches to the trailing edge visually via `dir="rtl"` and the active-item border flips to the correct side, (d) dark+AR. Resize below 768px, confirm sidebar disappears and hamburger + overlay work in all 4 combos too.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard-sidebar.tsx src/components/layout/ src/app/dashboard/layout.tsx
git commit -m "feat(design-system): 5-group sidebar, top bar, mobile nav overlay"
```

---

### Task 5: Shared UI primitives — StatusPill, ListToolbar, Drawer, Modal/BottomSheet

**Files:**
- Create: `src/components/ui/status-pill.tsx`, `src/components/ui/list-toolbar.tsx`, `src/components/ui/drawer.tsx`, `src/components/ui/modal.tsx`

**Interfaces:**
- Produces:
  - `<StatusPill tone="success" | "warning" | "danger" | "neutral">{label}</StatusPill>`
  - `<ListToolbar search={{value, onChange}} filters={ReactNode} onExport={() => void} />`
  - `<Drawer open={boolean} onClose={() => void} title={string}>{children}</Drawer>` — desktop side drawer / mobile full-screen sheet, switching at the 768px breakpoint via CSS, not JS (`Drawer` renders both structures and lets Tailwind's `md:` variants decide which is visible, so there's no layout flash on resize).
  - `<Modal open={boolean} onClose={() => void} variant="centered" | "bottom-sheet">{children}</Modal>`

- [ ] **Step 1: StatusPill**

```tsx
// src/components/ui/status-pill.tsx
const TONE_CLASSES = {
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  neutral: "bg-card text-text-tertiary border border-default",
} as const;

export function StatusPill({
  tone,
  children,
}: {
  tone: keyof typeof TONE_CLASSES;
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-normal ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
```

Callers decide the tone mapping per-domain (e.g. Vessels `active` → `success`, `inactive` → `warning`, `archived` → `neutral`) — that mapping lives in each module, not in this shared component, since "what counts as danger" differs per module (§1.3 lists the 3 tones as domain-agnostic primitives, not fixed per status string).

- [ ] **Step 2: ListToolbar (desktop toolbar row / mobile "Filters" button collapse per §3)**

```tsx
// src/components/ui/list-toolbar.tsx
"use client";

import { useState } from "react";

export function ListToolbar({
  searchValue,
  onSearchChange,
  filters,
  onExport,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: React.ReactNode;
  onExport: () => void;
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search…"
          className="h-10 w-full rounded-md border border-default bg-card px-3 text-sm text-text-primary md:flex-1"
        />
        <div className="hidden items-center gap-2 md:flex">
          {filters}
          <button type="button" onClick={onExport} className="h-10 rounded-md border border-default bg-transparent px-4 text-sm font-medium text-text-secondary">
            Export
          </button>
        </div>
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-default px-4 text-sm font-medium text-text-secondary md:hidden"
        >
          ⚗ Filters
        </button>
      </div>
      {mobileFiltersOpen ? (
        <div className="flex flex-col gap-2 rounded-md border border-default bg-card p-3 md:hidden">
          {filters}
          <button type="button" onClick={onExport} className="h-11 rounded-md border border-default px-4 text-sm font-medium text-text-secondary">
            Export
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Drawer (side drawer desktop / full-screen sheet mobile, per §4.1 and §4.3)**

```tsx
// src/components/ui/drawer.tsx
"use client";

import { useEffect, useId } from "react";

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const titleId = useId();

  // Escape-to-close and body scroll lock — both absent from an earlier version
  // of this component (caught in Cursor's independent review; Task 9's WCAG
  // pass would have caught the same gap later, at 13x the cost to fix).
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-black/50 hidden md:block" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 end-0 flex h-full w-full flex-col bg-card md:w-[380px] md:max-w-[90vw]">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-default px-4 md:h-auto md:border-0 md:pt-5">
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-tertiary md:hidden">
            ←
          </button>
          <h2 id={titleId} className="text-base font-medium text-text-primary">{title}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
```

`inset-y-0 end-0` (logical `end`, not `right`) is what makes this slide from the correct trailing edge in both LTR and RTL per §4.1 ("right in LTR, left in RTL — a true mirror").

**Not yet handled: a real focus trap** (Tab/Shift+Tab cycling within the open drawer rather than escaping to the page behind it). `role="dialog"`/`aria-modal`/Escape/scroll-lock above cover the most common WCAG findings cheaply — the accessibility gap Cursor's review flagged; a full focus trap is enough additional logic (or a small dependency) that it's called out here explicitly rather than silently included — add one (hand-rolled or a small library) before Task 9's accessibility pass, not after.

- [ ] **Step 4: Modal (centered desktop / bottom sheet mobile, per §4.2 and §4.4)**

```tsx
// src/components/ui/modal.tsx
"use client";

import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  // Modal has no required title prop (unlike Drawer), so there's no heading id
  // to point aria-labelledby at by default. Callers whose content doesn't
  // start with a visible heading must pass ariaLabel so the dialog still has
  // an accessible name — otherwise screen readers announce it as unlabeled.
  ariaLabel?: string;
}) {
  // Same Escape-to-close / body scroll lock gap as Drawer, caught in the same
  // review pass — both primitives were missing this before Task 9's WCAG pass.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full rounded-t-2xl bg-card p-4 md:w-[380px] md:rounded-lg md:p-5">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border md:hidden" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
```

**Same focus-trap caveat as Drawer** — Tab cycling within the open modal isn't implemented here either; add before Task 9's accessibility pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/status-pill.tsx src/components/ui/list-toolbar.tsx src/components/ui/drawer.tsx src/components/ui/modal.tsx
git commit -m "feat(design-system): StatusPill, ListToolbar, Drawer, Modal primitives"
```

---

### Task 6: Login screen (reference screen #1)

**Files:**
- Create: `src/app/login/page.tsx`

No auth backend exists yet (`MASTER_PLAN.md` Phase 3 is unbuilt) — this is a **static UI-only** screen per §8's "Login — Single form screen," wired to a placeholder `<form>` with no real submit handler yet. Don't invent a fake authentication flow; leave the form action as a TODO comment pointing at Phase 3, not a stubbed "fake login."

- [ ] **Step 1: Build the screen** (no code dictated here — build directly against `DESIGN_HANDOFF.md` §4 for the card/input styling and the token classes from Task 1; this is exactly the kind of single, isolated, look-at-it-live screen Cursor should build interactively rather than have handed to it as finished JSX)

- [ ] **Step 2: Verify** in light/dark × EN/AR (4 combinations) at both desktop and mobile widths.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/
git commit -m "feat(design-system): Login screen (reference implementation)"
```

---

### Task 7: Vessels list retrofit to the canonical list pattern (reference screen #2)

**Files:**
- Modify: `src/app/dashboard/vessels/page.tsx`

**Interfaces:**
- Consumes: `StatusPill`, `ListToolbar`, `Identifier` (Tasks 3 and 5).

- [ ] **Step 1:** Replace the current ad-hoc `<table>` markup with the canonical pattern from §3: header row (title + "+ Add vessel"), `<ListToolbar>` directly below (search + status filter `<select>` + Export), then the table using the new token classes (`bg-card`, `border-default`, `text-muted`/`text-secondary`). Wrap `v.name` and `formatImo(v.imoNumber)` in `<Identifier>` per the Global Constraints rule — these are exactly the vessel-name/IMO-number case §5 calls out by name. Replace the current bare `<span className="capitalize">{v.status}</span>` with `<StatusPill tone={...}>`, mapping `active` → `success`, `inactive` → `warning`, `archived` → `neutral`.
- [ ] **Step 2:** Add the mobile stacked-card layout per §3 ("Mobile") — each row becomes a card with the vessel name as the 14px/500 title, `StatusPill` top-right, remaining fields as label/value lines below.
- [ ] **Step 3: Verify** in light/dark × EN/AR at both desktop and mobile widths; confirm vessel names/IMO numbers stay LTR even when the row is in an RTL table.
- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/vessels/page.tsx
git commit -m "feat(design-system): retrofit Vessels list to canonical list pattern"
```

---

### Task 8: Vessels add/edit retrofit to the Drawer pattern

Currently `/dashboard/vessels/new` and `/dashboard/vessels/[id]/edit` are full page navigations (see `src/app/dashboard/vessels/new/page.tsx`, `src/app/dashboard/vessels/[id]/edit/page.tsx`). Per §4.1, add/edit must appear as a drawer **over** the list (dimmed backdrop showing the list, search/filter/export row included, behind it) — not a separate page.

**Files:**
- Modify: `src/app/dashboard/vessels/layout.tsx` (create if it doesn't exist — check first), `src/app/dashboard/vessels/new/page.tsx`, `src/app/dashboard/vessels/[id]/edit/page.tsx`
- The concrete mechanism is Next.js App Router **parallel + intercepting routes** (a `@drawer` slot in `vessels/layout.tsx`, with `(.)new/page.tsx` and `(.)[id]/edit/page.tsx` intercepting the direct-navigation versions) — this is the standard "modal over a list" pattern in App Router, but confirm the exact folder-naming convention against `node_modules/next/dist/docs/` for Next 16.2.4 before building it (per the Global Constraints Next-16 warning) rather than assuming it's unchanged from Next 13/14 docs.

**Close-semantics decision (flagged by Cursor's review, decided by Eng.MHD this session):** `createVesselAction`/`updateVesselAction` (`src/modules/vessels/actions.ts`) currently `redirect()` to the vessel detail page on success (`${vesselsPath}/${vessel.id}`) — a leftover from the pre-drawer, full-page-navigation flow. Decision: **redirect to the vessels list (`vesselsPath`) instead of the detail page**, not a return-state-and-self-close pattern. Concretely, as part of Step 3 below, change both `redirect(\`${vesselsPath}/${vessel.id}\`)` (create, currently line 96) and `redirect(\`${vesselsPath}/${id}\`)` (update, currently line 161) to `redirect(vesselsPath)`, and update the `VesselActionState` doc comment (currently says callers "read [the created/updated row] via `redirect()` to the detail page instead" — no longer accurate once this lands). This is a smaller change than a full return-state/self-close rework, at the cost of still doing a full navigation/reload rather than an in-place close — acceptable per Eng.MHD's decision. Cursor also recommended treating Vessels as a single pilot of the intercepting-route pattern before Task 10 replicates it 12 more times; this redirect-target change is part of that pilot.

- [ ] **Step 1:** Read the routing/parallel-routes doc under `node_modules/next/dist/docs/` and confirm the intercepting-route convention (`(.)folder`, `(..)folder`) is unchanged in 16.2.4.
- [ ] **Step 2:** Add the `@drawer` parallel slot to `src/app/dashboard/vessels/layout.tsx`, rendering `<Drawer>` (Task 5) around the intercepted content when present, `null` otherwise.
- [ ] **Step 2a: Add `src/app/dashboard/vessels/@drawer/default.tsx` returning `null`.** Gap caught in Cursor's review: any named parallel slot (`@drawer`) that isn't matched by the current URL needs a `default.tsx`, or Next.js 404s when navigating to a sibling route under `vessels/` (e.g. the list itself, or `[id]/page.tsx`) that has no corresponding `@drawer` segment. Without this file the retrofit breaks plain list navigation, not just the drawer case.
- [ ] **Step 3:** Move the `<VesselForm mode="create">` / `<VesselForm mode="edit">` markup into the intercepted routes; keep the existing `src/modules/vessels/actions.ts` Server Actions unchanged — this is a presentation-layer change, not a data-layer one.
- [ ] **Step 4:** Confirm direct navigation to `/dashboard/vessels/new` (e.g. a hard refresh, or a shared link) still renders a full, usable page — the non-intercepted fallback route — not a broken drawer-with-no-list-behind-it.
- [ ] **Step 5: Verify** open/close, backdrop dimming, and the mobile full-screen-sheet variant in light/dark × EN/AR.
- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/vessels/
git commit -m "feat(design-system): retrofit Vessels add/edit to Drawer pattern"
```

---

### Task 9: Full QA pass on the 3 reference surfaces

**Files:** none (verification only)

- [ ] **Step 1:** For each of Login, Vessels list, Vessels add/edit drawer — check all 8 combinations: {light, dark} × {EN, AR} × {desktop ≥1280px, mobile 375-414px}. Use the `design:accessibility-review` skill for a WCAG 2.1 AA pass per `DESIGN_HANDOFF.md` §6 (not yet formally audited anywhere in the project).
- [ ] **Step 2:** Confirm no component still uses a physical-direction Tailwind class (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `border-l-`, `border-r-`) where a logical one (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `border-s-`, `border-e-`) belongs — grep for these across the files touched in Tasks 4-8.
- [ ] **Step 3:** File any gaps found as follow-up items rather than silently patching around them mid-QA.

---

### Task 10: Package the pattern as a Skill, propagate to the remaining 12 modules

Everything above covers 2 of 13 modules named in `DESIGN_HANDOFF.md` §8. The other 12 (Certificates, Deficiencies, Crew, Insurance, Alerts, Manuals, ISM Templates, Monthly Forms, Drawings, Reminders, Settings, Particulars, plus Dashboard/Notifications) follow the exact same canonical list/drawer/modal patterns — this is the repetitive, must-stay-consistent-across-many-files task Claude Code should drive, not Cursor screen-by-screen.

**Files:**
- Create: `.claude/skills/fleetos-design-system/SKILL.md`

- [ ] **Step 1:** Write a Skill file whose body is a condensed pointer to `DESIGN_HANDOFF.md` (don't duplicate its content — reference it) plus the concrete primitive import paths this plan produced (`@/components/ui/status-pill`, `@/components/ui/drawer`, `@/components/ui/modal`, `@/components/ui/list-toolbar`, `@/components/ui/identifier`) and the two finished reference implementations (Vessels list + drawer) as the pattern to copy.
- [ ] **Step 2:** For each remaining module, dispatch one Claude Code subagent per module (per the `dispatching-parallel-agents` / `subagent-driven-development` skills already available in this environment), each given: the module's row from `DESIGN_HANDOFF.md` §8, the relevant schema/controller under `src/modules/<module>/` once it exists, and the finished Vessels retrofit (Tasks 7-8) as the literal pattern to match file-for-file.
- [ ] **Step 3:** Human (Eng.MHD) reviews each module's diff in Cursor before merging — this keeps the "many files, one pattern" bulk generation on Claude Code while keeping visual sign-off in the IDE where it's actually being looked at.

---

## Self-review notes

- Coverage check against `DESIGN_HANDOFF.md`: §1 (tokens) → Task 1. §2 (nav) → Task 4. §3 (list pattern) → Task 7. §4 (drawers/modals) → Tasks 5, 8. §5 (i18n/theming) → Tasks 2, 3. §6 (accessibility) → Task 9. §7 (edge cases: empty/loading states) is explicitly **not** covered by this plan — no task builds skeleton loading rows or empty states, matching §7's own note that these aren't mocked yet; flag as a gap if a later reviewer expects them. §8 (module index) → Task 10 for the 12 non-reference modules.
- Type/signature consistency: `StatusPill`'s `tone` prop and `Drawer`/`Modal`'s `open`/`onClose` props are used identically wherever referenced above.
- This plan does not touch `MASTER_PLAN.md` Phases 2-8 (Postgres migration, auth, RBAC, deployment) — those are separate, larger efforts with their own open decisions and aren't design-system work.
