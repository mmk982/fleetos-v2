# FleetOS — design handoff spec

System-level handoff for engineering (Cursor or any implementer). This is the developer-facing companion to `PROJECT_PLAN.md`: PROJECT_PLAN.md defines *what* FleetOS does (domain model, screens, requirements); this doc defines *exactly how the UI is built* — tokens, patterns, states, responsive rules — so nothing is left for the implementer to guess or newly design.

Source of truth: every rule below was validated against ~150 mockups built across all 13 modules (Vessels, Certificates, Deficiencies, Crew, Insurance, Alerts, Manuals, ISM Templates, Monthly Forms, Drawings, Reminders, Settings, plus Dashboard/Login/Notifications/Particulars) in light, dark, and Arabic RTL, at both desktop (~1280px+) and mobile (~375-414px) widths.

Tech stack assumed: Next.js, Tailwind CSS with `darkMode: "class"`, `next-themes` for theme persistence, logical CSS properties (`ms-*`/`me-*`, `ps-*`/`pe-*`) for automatic RTL mirroring instead of a separate RTL stylesheet.

---

## 1. Design tokens

### 1.1 Color — dark mode

| Token | Value | Usage |
|---|---|---|
| `--bg-page` | `#0B1526` | Page background |
| `--bg-sidebar` | `#0A1220` | Sidebar background |
| `--border` | `#1E2C45` | Default hairline border, dividers |
| `--bg-card` | `#101B30` | Card / row / input background |
| `--accent` | `#378ADD` | Primary actions, active nav indicator, links |
| `--text-primary` | `#F1F5F9` | Headings, primary labels, active nav text |
| `--text-secondary` | `#CBD5E1` | Body text, table cell values |
| `--text-tertiary` | `#8FA3C0` | Icons, secondary labels, muted UI text |
| `--text-muted` | `#5B729B` | Group headers, timestamps, placeholder-level text |

### 1.2 Color — light mode / Arabic

| Token | Value | Usage |
|---|---|---|
| `--bg-page` | `#F8FAFC` | Page background |
| `--bg-sidebar` | `#123A63` | Sidebar background (deep blue, not gray) |
| `--border` | `#E2E8F0` | Default hairline border |
| `--bg-card` | `#FFFFFF` | Card / row / input background |
| `--accent` | `#378ADD` | Primary actions (same hex both modes) |
| `--text-primary` | `#0F172A` | Headings |
| `--text-secondary` | `#334155` | Body text |
| `--text-tertiary` | `#64748B` | Icons, secondary labels |
| Sidebar text | `#E2E8F0` (inactive), `#FFFFFF` (active) | |
| Sidebar active highlight | `rgba(255,255,255,0.08)` fill | |

### 1.3 Status colors (semantic — never reuse for anything else)

| Status | Dark bg / text | Light bg / text |
|---|---|---|
| Valid / active / on track | `#085041` / `#5DCAA5` | `#EAF3DE` / `#27500A` |
| Due soon / on leave / warning | `#633806` / `#FAC775` | `#FAEEDA` / `#633806` |
| Expired / open deficiency / danger | `#791F1F` / `#F09595` | `#FCEBEB` / `#791F1F` |

Rule: text color is always the darkest (light mode) or lightest (dark mode) stop from the *same* family as the background — never plain black/gray/white on a status pill.

### 1.4 Typography

| Token | Value |
|---|---|
| `--font-latin` | `Inter, sans-serif` |
| `--font-arabic` | `'IBM Plex Sans Arabic', Inter, sans-serif` |
| Page title | 18px / 500 |
| Section/card title | 13-14px / 500 |
| Body / table cell | 13px / 400 |
| Label (form fields) | 12px / 400, `--text-tertiary` |
| Group header (sidebar) | 11px / 500, `--text-muted`, letter-spacing implied by caps |
| Status pill | 11px / 400 |

### 1.5 Spacing & radius

| Token | Value |
|---|---|
| Page padding | 20px (desktop), 16px (mobile) |
| Card/input radius | 6-8px |
| Card padding | 14-20px |
| Row vertical padding | 8-12px |
| Sidebar item padding | 8px 16px (desktop), 12px 20px (mobile full-screen menu) |
| Gap between stacked cards (mobile) | 10px |

---

## 2. Navigation

### 2.1 Desktop (≥768px): docked sidebar

Fixed 220px sidebar, always visible, never collapsed regardless of active page. Exactly 5 groups, always rendered in full:

1. **OVERVIEW** — Dashboard
2. **FLEET** — Vessels, Crew, Particulars
3. **COMPLIANCE** — Certificates, Deficiencies, Insurance, Alerts, **PSC
   (stub, §7b/PROJECT_PLAN.md)**
4. **SETTINGS** *(rendered last)* — Settings
5. **DOCUMENTS** — Manuals, ISM templates, Monthly forms, Drawings, Reminders

(Order above matches source order in mockups: OVERVIEW, FLEET, COMPLIANCE, DOCUMENTS, SETTINGS.)

**Revision note (this session, after Cursor's independent review):** PSC had
no slot in any group in an earlier version of this spec despite
`PROJECT_PLAN.md` §7b promising it a sidebar entry. Decision (Eng.MHD, this
session): PSC nests inside COMPLIANCE as a stub/placeholder item rather than
becoming a 6th group — the "exactly 5 groups" constraint above stays intact.

Active item: `background: var(--bg-card)`, `border-left: 2px solid var(--accent)` (dark) or `border-right: 2px solid #85B7EB` + `background: rgba(255,255,255,0.08)` (light/Arabic — mirrored, not just flipped color). Single-sided border accents must have `border-radius: 0`.

Top bar (56px, in-flow next to sidebar, not the page top): company name (left/leading), then date, language toggle, theme toggle, notification bell, avatar circle (28px) on the trailing edge.

### 2.2 Mobile (<768px): hamburger + full-screen overlay

The docked sidebar does not appear at all below 768px. Replaced by:
- A 52px top bar: hamburger icon (leading edge) · app name (center) · bell + avatar (trailing edge), mirrored in RTL.
- Tapping the hamburger opens the same 5-group nav as a **full-screen overlay** (not a slide-out drawer) — close (×) icon replaces the hamburger, app name stays centered.
- This is a mechanical transform of the desktop nav structure — no new information architecture, no reduced nav depth.

### 2.3 Breakpoints

| Breakpoint | Behavior |
|---|---|
| Desktop (≥1280px) | Full layout as designed — this is the primary designed width |
| Tablet (768-1279px) | Inherits desktop layout unchanged (not separately verified — flag if issues surface) |
| Mobile (<768px) | Hamburger nav, stacked cards, full-screen sheets — see below |

---

## 3. Canonical list-screen pattern

Applies to: Vessels, Certificates, Deficiencies, Crew, Insurance, Manuals, ISM Templates, Monthly Forms, Drawings, Reminders, Users & Roles. (Alerts is list-only with filters but no Export/Add-record pattern beyond marking read.)

### Desktop
- Header row: page title (left) + primary action button (e.g. "+ Add vessel") (right).
- Toolbar row directly below: search input (flexible width) + 1-2 filter `<select>`s + "Export" button (transparent bg, bordered).
- Table: `grid-template-columns` with 4-5 fixed columns, header row in `--text-muted` 12px, body rows in `--text-secondary` 13px, status column renders a pill.
- Vessel names, IMO numbers, policy/certificate numbers: always `direction: ltr; unicode-bidi: isolate` even inside an RTL (Arabic) layout — these are identifiers, not translatable text, and must not visually reverse.

### Mobile
- Search input goes full-width, own row.
- Filter dropdowns + Export collapse into a single "Filters" button (bordered, filter icon + label) that opens a filter panel — avoids a horizontally-scrolling toolbar.
- Each table row becomes a stacked card: primary field as card title (14px/500), status pill top-right of the title row, remaining columns as labeled key/value lines below in 12px `--text-tertiary` (label) / `--text-secondary` or primary (value).

---

## 4. Drawers, modals, and sheets

### 4.1 Desktop: side drawer (add/edit forms)

- Fixed width 360-380px, slides from the trailing edge (right in LTR, left in RTL — a true mirror, not just repositioned).
- Sits over a dimmed backdrop (`rgba(0,0,0,0.5)`) showing the full page (including sidebar and, for list screens, the search/filter/export row) behind it — never a blank or partial background.
- Structure: title (16px/500) → stacked form fields (label 12px above each input) → primary action button (filled, accent) + secondary "Cancel" (bordered, transparent) side by side at the bottom.
- File upload fields: dashed-border dropzone with upload icon + "Tap/click to upload file" — not a native `<input type="file">` styled raw.

### 4.2 Desktop: centered modal (confirmations, Change Password)

- Centered over the same dimmed backdrop, fixed width ~380px, rounded corners all sides.
- Destructive actions (Deactivate user): primary button uses the danger color pair (bg `#791F1F`/text `#F09595` dark, bg `#FCEBEB`/text `#791F1F` light) — never the accent blue for a destructive confirm.

### 4.3 Mobile: full-screen sheet (replaces side drawer)

- Occupies the entire viewport — no dimmed backdrop needed since there's no page visible behind it.
- Own compact top bar: back arrow (leading edge, mirrors to point the correct direction in RTL) + title — no separate close button needed, back arrow serves both purposes.
- Same field structure as desktop drawer, full-width inputs, `box-sizing: border-box`.

### 4.4 Mobile: bottom sheet (replaces centered modal + kebab dropdown)

- Anchored to the bottom edge, rounded top corners only (`16px 16px 0 0`), full width, small drag-handle bar (36×4px, `--border` color) centered at the top for affordance.
- Used for: row-level kebab/action menus (Edit/Change password/View activity log/Deactivate — the mobile equivalent of a floating dropdown), confirmation dialogs, and Change Password.
- Kebab-triggered action sheets list actions as plain rows (14px), destructive action in the danger text color, no icons required.

---

## 5. Internationalization & theming

- Two independent toggles: **theme** (light/dark, via `next-themes` + Tailwind `dark:` variants) and **locale** (EN/AR). All four combinations must render correctly: light+EN, dark+EN, light+AR, dark+AR. Never couple locale to theme.
- RTL is driven by `dir="rtl"` on the root plus logical CSS properties (`margin-inline-start`, `border-inline-end`, etc.) — not a hand-authored mirrored stylesheet. Icons that imply direction (chevrons, back/forward arrows) flip in RTL; status/module icons do not.
- Font swap: `Inter` (Latin) → `'IBM Plex Sans Arabic', Inter, sans-serif` (Arabic), applied at the root when `dir="rtl"`.
- **Identifiers stay LTR everywhere**: vessel names, IMO numbers, certificate/policy numbers, file names — wrap in `direction: ltr; unicode-bidi: isolate` even when embedded in an Arabic sentence or RTL table row. This was corrected once already during design (see PROJECT_PLAN.md §14a) — do not regress it.
- Persistence: `preferredLocale` and `preferredTheme` stored on the signed-in user's row, with a cookie-driven fallback before login (see PROJECT_PLAN.md §14a/§14b for the full architecture note).

---

## 6. Accessibility

- Minimum 44px tap target on mobile for all interactive elements (buttons, nav rows, kebab triggers), even where the visual element is smaller (e.g. a 32px icon button still needs 44px of tappable area).
- Icon-only buttons require an `aria-label`; decorative icons get `aria-hidden="true"`.
- Status pills communicate meaning through both color and text label — never color alone.
- Focus order follows visual order (top-to-bottom, leading-to-trailing edge — respecting RTL mirroring).
- Run a full WCAG 2.1 AA pass (contrast, keyboard nav, touch target size) before final ship — flagged as a follow-up, not yet formally audited.

---

## 7. Edge cases (apply to every list/detail screen)

- **Empty state**: no dedicated empty-state mockup exists yet — implementer should follow standard product copy conventions (headline naming the space + one-line body + primary CTA), consistent with the "invitation, not apology" tone already used elsewhere (e.g. "+ Add vessel", "+ Log deficiency").
- **Long identifiers**: certificate/policy numbers and vessel names are never truncated in mockups — assume they must fit or wrap, not ellipsize, since they're compliance-critical identifiers.
- **Loading states**: not explicitly mocked — use skeleton rows matching the card/table row height, not a spinner overlay, to avoid layout shift.
- **Long Arabic labels**: several category/status labels are visibly longer in Arabic than English (e.g. "على متن السفينة" vs "On board") — pill and card layouts must not assume English string lengths.

---

## 8. Module screen index

Every module below has dark, light, and Arabic RTL variants at both desktop and mobile widths (mockups built across this session; not attached files — reference `PROJECT_PLAN.md` §14c/§14d for the build log).

| Module | Screens |
|---|---|
| Dashboard | Overview (7 KPI cards / 4 sections desktop, stacked cards mobile) |
| Login | Single form screen |
| Notifications | Bell dropdown (desktop), inline in mobile top bar |
| Vessels | List, detail (tabbed: overview/particulars/notes), add drawer, edit drawer |
| Particulars | Fleet-wide list, add/edit drawer |
| Crew | List, detail, add drawer, edit drawer |
| Certificates | Canonical list (search+filter+export), detail, add drawer, edit drawer |
| Deficiencies | List, detail, log drawer, edit drawer |
| Insurance | List, detail, add drawer |
| Alerts | List/feed with filters, no add/edit |
| Manuals | List, detail, add drawer |
| ISM templates | List, detail, add drawer |
| Monthly forms | List, submit drawer |
| Drawings | List, detail, add drawer |
| Reminders | List, add/edit drawer |
| Settings — General | Config form (localization, notifications, security sections) |
| Settings — Company profile | Config form (identity, head office, contacts) |
| Settings — Form requirements | Toggle list grouped by category |
| Settings — Users & roles | List, kebab menu/action sheet, edit drawer, change-password modal/sheet, deactivate modal/sheet, activity log drawer/sheet |
| Settings — System lists | Card + manager modal |

---

## 9. Open items / not yet covered

- Empty, loading, and error states are not individually mocked per screen (see §7) — apply the stated conventions rather than improvising per-screen.
- Tablet breakpoint (768-1023px) is assumed to inherit desktop, not independently verified.
- No formal WCAG audit has been run yet (see §6).
