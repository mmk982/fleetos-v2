# FleetOS — Plan Review

An independent, critical read of everything currently written: `MASTER_PLAN.md`, `PROJECT_PLAN.md`, `CERTIFICATES_SPEC.md`, `DESIGN_HANDOFF.md`, `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md`, `MASTER_IMPLEMENTATION_PLAN.md`, `CODE_CONVENTIONS.md`. Two of those seven (the last two) are mine from earlier this session, so this review includes real self-critique, not just praise for the pre-existing docs — flagged explicitly where the gap is something I introduced rather than something already in `PROJECT_PLAN.md`/`MASTER_PLAN.md`.

Findings are tagged by severity: 🔴 blocking or must-decide-before-the-relevant-phase, 🟡 a real risk worth a deliberate decision, 🟢 minor/nice-to-have. Nothing here is a request to redo work — it's a punch list to fold into the next revision pass of the relevant document.

## What's genuinely strong

Worth saying plainly before the findings list, since a review that's all criticism misrepresents the actual state of this project: the planning discipline across `MASTER_PLAN.md`/`PROJECT_PLAN.md`/`CERTIFICATES_SPEC.md` is well above what most projects have before writing a line of code.

- **The derived-vs-stored discipline is applied consistently, not just in the one place it was invented.** The expiry engine's "never trust a stored status column" rule shows up again, independently, in Monthly Executed Forms' `deriveMonthlyFormDisplayStatus` (an earlier draft that stored `"overdue"` directly was caught and fixed specifically because it violated this same principle). That's a real, internalized engineering value, not a one-off.
- **The delete-policy taxonomy** (`RESTRICT` for cross-entity references, `CASCADE` for owned children, `SET NULL` for log-userId columns, §0.9) is applied uniformly across every one of the ~15 tables that need it, with the reasoning for each category stated once and then followed everywhere — no table quietly does its own thing.
- **The reference-table promotion pattern** (`certificate_types`, `issuing_authorities`, `deficiency_sources`, `deficiency_severity_levels`, `crew_categories`, `endorsement_types`, `ism_template_categories`, `drawing_categories`) is applied to every field that real usage is likely to outgrow, and consolidated into one Settings "System Lists" hub rather than scattered CRUD pages — a genuinely good MVP-extensibility call.
- **The revision history is self-correcting in public.** Multiple "Revision note" callouts document real mistakes caught on re-review (the SQLite-era `isSqliteUniqueError` naming, the stray duplicate `isRequired`/`activeStatus` boolean, the single-rule delete policy that would have blocked deleting any user with one log entry) and fixed them rather than leaving them or hiding the correction. That's a rare, valuable trait in a planning document.
- **Governance discipline**: every plan document is explicit that it's a plan, not a build authorization, and open items are tracked as open rather than quietly resolved by assumption.

## 🔴 Sequencing tensions that need an explicit decision, not an implicit one

### 1. Auth's position conflicts between the two source plans

> **Superseded (Round 2/3):** this finding described the state before
> `PROJECT_PLAN.md`'s build order was renumbered — Auth is step 0 now, not
> step 14, and the "steps 0–13 don't need it" framing below was removed.
> Kept as-written for the historical record of what the original finding
> was; don't read the step numbers below as current.

`MASTER_PLAN.md`'s phase order puts Authentication at **Phase 3**, ahead of the Phase 5 feature build. `PROJECT_PLAN.md`'s own "Suggested build order" lists Auth as **step 14 of 15** — nearly last — with the explicit framing "not part of this feature build order... two items explicitly depend on it" (Notifications, user/role management), implying steps 0–13 (every other module) don't need it and could ship first.

These two documents genuinely disagree on when auth happens, and neither one calls out the disagreement. `MASTER_IMPLEMENTATION_PLAN.md` (mine) resolved this silently in favor of `MASTER_PLAN.md`'s ordering — build auth early (Phase 3), before any module's `actions.ts` exists, so every Server Action gets a real session check from its first commit instead of a 13-module retrofit pass later. I think that's the right call, but I made it without flagging that a choice was being made. **Recommendation:** add one sentence to `PROJECT_PLAN.md`'s build-order section stating this explicitly, so a future reader doesn't hit the apparent contradiction and wonder which document is stale.

### 2. Phase 4's RLS task is downstream of a phase that's explicitly unscheduled

`MASTER_IMPLEMENTATION_PLAN.md` (mine) correctly sequences Phase 4's row-level-security policies *after* Phase 6 (RBAC), since RLS needs role data that doesn't exist yet. But Phase 6 itself is **blocked, not scheduled** — the 5-role × 3-tier permission mapping isn't defined by either source requirements document, and nobody has committed to when that decision arrives. `MASTER_PLAN.md` states "GDPR-level rigor is the security baseline" as a locked decision; if the RBAC mapping decision stalls, RLS — one of the two concrete technical reasons Postgres was chosen over SQLite in the first place — never lands, silently. **Recommendation:** add an explicit interim position: ship with app-layer-only enforcement and a documented, dated known-gap if Phase 6 isn't ready by go-live, rather than an open-ended "after Phase 6" with no fallback.

### 3. Theme/locale persistence has two different architectures in two different documents, unreconciled

`DESIGN_HANDOFF.md` §5 specifies the intended architecture: `preferredLocale`/`preferredTheme` **stored on the signed-in user's row**, with a cookie-driven fallback before login. But `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 2 wires `next-themes`, whose default persistence is **client-side storage**, and Task 3 explicitly calls its own cookie-based locale toggle "a stand-in, not the final persisted architecture." `MASTER_IMPLEMENTATION_PLAN.md`'s Phase 3 adds the `preferredLocale`/`preferredTheme` columns to the new `users` table but never adds the task that actually wires them up — reading the cookie/DB value on login, writing back on toggle, and deciding what `next-themes` should do once a real per-user value exists (keep it as a fast client cache synced from the server value, or replace it outright). This is a gap I introduced across two of my own documents, not something inherited from the original specs. **Recommendation:** add an explicit Phase 3 subtask: "replace the Phase 1 cookie/next-themes stand-in with `users.preferredLocale`/`preferredTheme`, keeping the pre-login cookie fallback `DESIGN_HANDOFF.md` §5 calls for."

## 🟡 Real risks worth a deliberate decision

### 4. Intercepting-route drawers, repeated across 13 modules, is a lot of fragile boilerplate

`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 8 converts Vessels' add/edit to Next.js parallel + intercepting routes (a `@drawer` slot + `(.)new`/`(.)[id]/edit` folders) so the drawer overlays the list per `DESIGN_HANDOFF.md` §4.1. `MASTER_IMPLEMENTATION_PLAN.md`'s Task 5.2+ then has every one of the remaining 12 modules repeat that same folder structure. Intercepting routes are one of the more failure-prone corners of the App Router (behavior around direct links, the back button, and nested layouts has real edge cases, and Task 8 itself already flags needing to re-verify the convention against Next 16's docs before relying on it). Replicating a fragile pattern 13 times multiplies the failure surface by 13. **Recommendation:** after Vessels (Task 5.2's Certificates, specifically) is built and its drawer routing is verified working end-to-end including direct-link and back-button behavior, treat extracting a small shared helper (a layout factory, or a documented copy-paste checklist with the exact edge cases to test) as part of Task 10's "package the pattern" step — don't let each of the 12 remaining modules independently rediscover the same edge cases.

### 5. `vessel_types`/`flag_states` conversion needs a data-backfill step that isn't currently its own task

`PROJECT_PLAN.md` §7a notes that converting `vessels.vesselType`/`vessels.flagState` from free text to `vesselTypeId`/`flagStateId` FKs is "a schema migration on existing shipped data... existing rows need a backfill/mapping step" — correctly flagged as different from a fresh table. But `MASTER_IMPLEMENTATION_PLAN.md`'s Task 5.3 (the Settings module task) doesn't call this out as its own checklist item; it's currently just prose inside `PROJECT_PLAN.md` that a future implementer could miss when working from the task list rather than the full spec. **Recommendation:** add an explicit subtask to Task 5.3's Settings entry: "backfill existing `vessels.vesselType`/`flagState` free-text values against the seeded `vessel_types`/`flag_states` lists (exact match → link; no match → create as a `isCustom = true` entry), then drop the old free-text columns" — with the fallback rule stated, not left to be improvised at migration time.

### 6. Sidebar-always-full-five-groups vs. RBAC-restricted pages is an unresolved interaction

`DESIGN_HANDOFF.md` §2.1 locks in "exactly 5 groups, always rendered in full, never collapsed regardless of active page" as a hard UI constraint. Separately, `PROJECT_PLAN.md` §7a states the Users & Roles page (inside the SETTINGS group) is Admin-only, with "the other four roles get no access to this page." Neither document says what happens to that *nav item* for a non-Admin role once Phase 6 ships — does it stay visible and just 403 on click, get grayed out with a tooltip, or disappear (which would violate §2.1's "always in full" rule as currently worded)? This is a real product decision, not an implementation detail, and it'll surface for every role-gated page, not just this one. **Recommendation:** resolve this once, as a stated policy (e.g., "role-restricted nav items render disabled/grayed rather than hidden, preserving the always-5-groups rule"), before Phase 6 rather than improvising it per-page.

### 7. `insurance_policies.coverageAmount` is `integer`; every physical-measurement field elsewhere upgraded to `numeric` for the same reasoning

`PROJECT_PLAN.md` §13 explicitly upgraded `vessel_particulars`' dimension/capacity fields from `integer` to `numeric` because "physical measurements that can carry decimals... `integer` would silently truncate them." `coverageAmount` (§4) is a monetary amount stored as plain `integer`, which has the same class of problem in the opposite direction: if it's meant to store fractional currency units directly (not cents), it truncates decimals the same way the particulars fields would have; if it's meant to store whole currency units only, a large H&M policy in a weaker currency could plausibly approach the ~2.1 billion ceiling of a 32-bit integer. Neither documented assumption is stated. **Recommendation:** decide explicitly (a `numeric(14,2)` column is the standard pattern for monetary amounts) rather than carrying the ambiguity into the Insurance module build.

### 8. Test coverage is thin for a compliance product specifically, not just thin in general

`PROJECT_PLAN.md`'s cross-cutting notes correctly scope Vitest to the expiry engine only for v1, deferring DB-touching tests until CI has a real Postgres instance (Phase 2). That's a reasonable MVP call in general — but this app's core value proposition is "tell a ship operator when a certificate is about to lapse," so a silent FK-policy misconfiguration (the wrong delete behavior on a table, or a rule the engine evaluates slightly wrong) has a materially worse failure mode here than in a typical CRUD app. **Recommendation:** once Phase 2's CI Postgres exists, prioritize integration tests for the RESTRICT/CASCADE/SET NULL delete behavior specifically (it's silent until someone tries the wrong delete in production) ahead of general CRUD test coverage — narrow, high-value, not "add tests everywhere."

### 9. Single-person VPS fleet is a real bus-factor risk, already accepted but not mitigated

`MASTER_PLAN.md`'s locked decisions state "you personally provision/maintain every customer's VPS." That's a defensible MVP choice for a small team, but as the customer count grows it's a single point of failure for every deployed customer at once, not just a scaling-cost question. **Recommendation:** even before this becomes urgent, keep a written runbook + a credential-escrow plan (e.g., a shared password manager vault with the Hetzner/Backblaze/DNS credentials for every customer) so the business doesn't stall if that one person is unreachable — cheap insurance against a risk that's currently undocumented, not unmanageable.

## 🟢 Minor / worth a look, not urgent

- **`Identifier`'s inline `style` prop** (`direction: ltr; unicode-bidi: isolate`) is the one place in the design-system primitives that isn't a Tailwind utility class, since neither property has a default Tailwind utility. Functionally correct; just inconsistent with the rest of the codebase's all-classes convention. A `dir-ltr-isolate` custom utility in `globals.css`'s `@theme` layer would restore consistency if that matters to the team.
- **`reminders.relatedItemKind`/`relatedItemId`** is explicitly a non-FK polymorphic reference, and the source doc already flags that a deleted related item becomes a gracefully-orphaned reference. Worth calling out specifically as a test case once any test coverage exists for Reminders, since "orphaned reference doesn't crash the UI" is exactly the kind of thing that's fine until the first real deletion happens in production.
- **Seed data for the newer reference lists** (`deficiency_severity_levels`, `crew_categories`, `endorsement_types`, `vessel_types`, `flag_states`) is explicitly marked as illustrative placeholders in `PROJECT_PLAN.md`'s Status section, not confirmed values. Worth a standing pre-launch checklist item ("no module ships with placeholder seed data unreviewed") rather than relying on memory that this note exists.
- **`CODE_CONVENTIONS.md` has no automated enforcement** — it's currently a human-review-discipline standard. Recommend adding `eslint-plugin-jsdoc` (or similar) scoped to `src/modules/**/*.ts` and `src/lib/**/*.ts`, wired into the existing GitHub Actions lint step, so a missing doc comment on an exported function fails CI the same way a type error would, rather than depending on a reviewer noticing.
- **Task checklists in `MASTER_IMPLEMENTATION_PLAN.md` don't include an explicit "docs verified" checkbox** per module task — the requirement is stated in prose ("a task isn't done until its exported code is documented") but isn't one of the literal checkboxes a task-executor ticks off. Small process tightening: add it as a literal step, not just a stated expectation.

## Summary — what to actually do with this

Nothing above blocks continuing Phase 2 (the Postgres migration) or Task 5.1 (the expiry engine) — neither touches any of these findings. Before Phase 3 (auth) starts, resolve finding #1 (state the auth-sequencing choice explicitly) and finding #3 (add the missing theme/locale persistence task). Before Phase 5's Insurance task, decide finding #7 (`coverageAmount` type) since it's cheap now and a migration later. Findings #2, #6, and #9 are decisions to make before their respective phases (6, 6, 7) actually start, not before any code gets written today.

---

## Round 2 — reconciling Cursor's independent review

Per Eng.MHD's instruction, Cursor was given every planning document above (not the codebase) and asked for an independent critique, explicitly told not to write or edit any code. Cursor's review covered four areas: internal inconsistencies across the docs, Postgres/auth/RBAC/security implementation risks, `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 8 concerns, and task right-sizing — plus a spot-check of the doc-comment retrofit against `CODE_CONVENTIONS.md`. What follows is what was verified and changed as a result, not a re-statement of Cursor's review itself (that response is only in this conversation's history, not saved as its own file).

### Fixed directly (confirmed, unambiguous — no decision needed)

- **Free-text FK columns now real FKs from day one.** Since Auth (Phase 3) precedes every Phase 5 module, `uploadedBy`/`responsiblePerson`/`authorId`-style columns across ~9 tables no longer need a deferred "convert to FK" v2-backlog item — they're `uuid` FKs to `users.id` (`ON DELETE SET NULL`) from their first migration. Updated `erd-full-schema.mermaid` (all affected columns), `module-build-order.mermaid` (Notifications no longer shown as blocked), and `MASTER_IMPLEMENTATION_PLAN.md` Phase 3/Phase 5.
- **`module-build-order.mermaid`** now shows Auth as a foundation node built before Vessels and everything else, and splits Settings' "Users & Roles" sub-page (needs Auth) from the rest of Settings (doesn't).
- **Security recommendations that had no landing task.** Rate limiting, breached-password checks, the break-glass admin script, security headers, and Origin/Sec-Fetch-Site verification — all previously living only in `SECURITY_PLAN.md` with no corresponding checklist item — are now literal bullets in `MASTER_IMPLEMENTATION_PLAN.md` Phase 3.
- **Missing attachment-serving route.** Added `src/app/api/attachments/[id]/route.ts` as an explicit deliverable of Task 5.2 (Certificates) — every module needs one and `SECURITY_PLAN.md` §6 requires it, but nothing had specified where it gets built.
- **Task 5.3's scope crept beyond "match Certificates file-for-file."** Renamed and re-scoped to cover only the remaining CRUD modules; carved the vessel-detail integration pass, Alerts, Dashboard, and Export into a new Task 5.4 with their own tool assignments (these don't fit the repeatable-module pattern).
- **`@drawer` parallel-route slot missing a `default.tsx`.** Without one, Next.js 404s on any sibling route under `vessels/` that doesn't match the slot. Added as Step 2a of Task 8.
- **`Drawer`/`Modal` accessibility gaps.** Neither primitive had `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape-to-close, or body scroll lock. Added all of these to both components in `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 5 (a hand-rolled focus trap is still explicitly called out as *not yet added* — flagged inline as a Task 9 prerequisite, not silently included).
- **Doc-comment gaps in the Vessels retrofit spot-check.** `VesselStatus` (`src/db/schema.ts`) and `VesselCreateInput`/`VesselUpdateInput` (`src/modules/vessels/validation.ts`) now have their own TSDoc rather than relying on the comment above the const/schema they're derived from. Verified via `tsc --noEmit` after each edit — no errors.
- **PSC nav gap.** `DESIGN_HANDOFF.md`'s locked "exactly 5 groups" sidebar spec had no slot for PSC despite `PROJECT_PLAN.md` §7b promising it a sidebar entry. Resolved by decision below, not silently.
- **i18n routing conflict.** `PROJECT_PLAN.md` §14a specified `next-intl` path-based routing (`/en/...`/`/ar/...`); `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 3 was actually built cookie-based, single-path. Resolved by decision below, not silently.
- **Drawer close-semantics contradiction.** `createVesselAction`/`updateVesselAction` redirect to the vessel detail page on success — incompatible with a drawer-over-list UX once Task 8 lands. Resolved by decision below.

### Resolved by explicit decision (asked, not assumed)

Three items were genuine architecture calls, not verifiable-right-or-wrong facts, so they were put to Eng.MHD directly rather than picked silently:

1. **i18n routing model** — decided: **keep cookie-based, single-path** (as actually built), not `next-intl` path-based routing. `PROJECT_PLAN.md` §14a revised to match, with a revision note explaining the discrepancy and the decision.
2. **PSC nav placement** — decided: **PSC nests inside the COMPLIANCE group** as a stub item, not a 6th top-level group. `DESIGN_HANDOFF.md`'s sidebar spec and `PROJECT_PLAN.md` §7b both updated.
3. **Drawer close-semantics** — decided: **redirect to the vessels list, not the detail page**, on successful create/update (not a return-state/self-close rework). Captured as a concrete step in `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 8, to be applied to `src/modules/vessels/actions.ts` when Task 8 is actually built — not applied to the live source now, since the drawer it's meant to close doesn't exist yet and changing the redirect target today would just break the current full-page flow with nothing to replace it.

### Not yet actioned (as of Round 2)

~~`PROJECT_PLAN.md`'s stale "#0D2B45" brand-color reference~~ and ~~the
v2-backlog grep pass~~ — **both done, this note itself was stale.**
Cursor's round-3 review caught that this list said "not yet fixed" for the
brand color after it had already been fixed in the same editing session,
and that the promised grep pass had in fact found more than the free-text-FK
item. See "Round 3" below for what that pass actually turned up. Lesson
taken: don't leave a "not yet actioned" list sitting past the point where
its own items get resolved — check it, or delete it, in the same pass.

---

## Round 3 — a second Cursor pass, plus a self-directed skim

Asked Cursor to review again after Round 2 landed, specifically checking whether the round-2 changes were applied consistently everywhere and whether they introduced anything new. This is what it found and what got fixed:

### Confirmed and fixed

- **Build-order renumbering was incomplete.** Round 2 renumbered `PROJECT_PLAN.md`'s "Suggested build order" (Auth → step 0) but never propagated that to `MASTER_IMPLEMENTATION_PLAN.md`'s Phase 5 table, Tasks 5.1/5.2/5.4's inline step references, or `module-build-order.mermaid`'s node labels — all three were still on the old numbering (Auth at step 14, engine at step 1, Certificates at step 2, etc.), which is arguably worse than not renumbering at all since the three sources now actively disagreed. Fixed: Phase 5 table and every Task 5.x step reference renumbered to match; mermaid labels renumbered with Auth as node 0.
- **`activity_logs.userId`** (`PROJECT_PLAN.md` §6, and the ERD) still said "no FK constraint initially... `users` doesn't exist until Phase 3" — the same free-text/deferred-FK assumption Round 2 fixed on ~9 other columns, just missed on this one since it isn't an `*_attachments` table. Fixed: real FK from the first migration, same as the others.
- **`MASTER_PLAN.md`** still described "every `uploadedBy`-becomes-a-real-FK-later column" in one paragraph confirming named user accounts — stale now that these are real FKs from day one, not a later conversion. Fixed.
- **Notifications' "explicit dependency" framing was stale.** §12a said Notifications was the one module (unlike every other) that couldn't be built before Auth existed. Once Auth became step 0, that's true of every module, not just Notifications — the "unlike every other module" framing was backwards. Fixed to describe Notifications as an ordinary module now, not a special case.
- **The "MVP scope cuts / v2 backlog" section still listed Notifications and full user/role management as blocked/deferred items** — stale for the same reason: that framing assumed Auth was scheduled last. Struck, since Auth-first means neither is actually deferred.
- **`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 4's actual `NAV_GROUPS` array had no PSC entry**, even though the PSC-under-COMPLIANCE decision was recorded in `DESIGN_HANDOFF.md` and `PROJECT_PLAN.md` §7b — those are the prose spec, but `NAV_GROUPS` is the literal code an implementing agent copies. Added.
- **`certificate_attachments` was missing `uploadedBy`** while every other `*_attachments` table had it — a real asymmetry against the "~9 tables, all real FKs" claim, not a documented exception. Added, matching the same FK/SET NULL pattern as the others.
- **This file's own "Not yet actioned" list was stale** (see above) — the brand-color item had already been fixed in the same session it was flagged as pending.

### Not a bug, clarified instead

- **Notifications has no number of its own in the 0–15 build-order list** — Cursor flagged this as an orphan. Correct observation, but by design: Notifications isn't a standalone module with its own build session, it's a table plus generation hooks added by other modules' controllers as they're built. Added a one-paragraph note to `PROJECT_PLAN.md` explaining this rather than forcing it into a numbered slot.

### Flagged, not yet actioned

- **i18n library naming got blurred.** The cookie-based routing decision is locked, but the revised §14a bullet no longer names a specific message-catalog library (previously `next-intl`) — just `messages/en.json`/`ar.json`. Not wrong, but looser than before; worth deciding explicitly whether `next-intl` (in cookie mode, `localePrefix: "never"`) or a lighter hand-rolled catalog loader is the actual pick, since Task 3 doesn't install anything yet either way.
- **Conventions section still reads pre-Auth, pre-drawer.** `PROJECT_PLAN.md`'s Conventions section opens with "No auth, single-tenant" and describes `new`/`[id]/edit` as full pages — accurate for the Vessels code that exists today, but increasingly misleading as the *standing* convention new modules should follow, now that Auth is step 0 and Task 8's drawer pattern is meant to be the template. Not introduced by Round 2 or 3, but worth a revision note next time this section is touched.
- **Theme/locale persistence wiring** as its own Phase 3 checklist task, **RBAC nav visibility** (hide/disable/403), **`coverageAmount` integer vs. `numeric(14,2)`**, **`vessel_types`/`flag_states` backfill** as its own checkbox, **Settings "Reports" vs. `DESIGN_HANDOFF.md` §8 gap**, and **`npm audit` in CI / magic-byte file validation** tasks — all still open from earlier rounds, unchanged by this pass.

---

## Round 4 — a third Cursor pass, verifying Round 3's fixes held

Asked Cursor to re-verify Round 3's fixes end-to-end (all three build-order sources agreeing, not just spot-checked) and re-check the two items Round 3 left flagged-but-open. Round 3's renumbering and every listed fix confirmed as landed correctly and consistently, with no new numbering disagreement across `PROJECT_PLAN.md`/`MASTER_IMPLEMENTATION_PLAN.md`/`module-build-order.mermaid`. This pass found:

### Confirmed and fixed

- **Reminders (step 12, §12) was in the Phase 5 table but had no owning task.** Task 5.3's module list (Deficiencies, Crew, Insurance, ISM Templates, Manuals, Drawings, Monthly Executed Forms, Settings, Ship Particulars) never included it, and Task 5.4's non-module list didn't either — it fell through a gap between the two. It's plain CRUD with no special dependencies, so it belongs in Task 5.3. Added, with the title updated to `steps 1, 4–9, 12, 14`.
- **Phase 3's "Action:" paragraph was still written as a to-do** (update `PROJECT_PLAN.md`'s schema tables, strike the backlog item, drop the Notifications "BLOCKED" annotation) describing work that Round 2/3 already completed. Reworded to past tense/history so it can't be misread as a remaining task.
- **Task 5.3's Settings bullet still said the `AUTH --> SET` mermaid edge "currently implies"** deferring Settings behind Auth, as if that were still a live problem needing a fix "alongside this task." The diagram has been `AUTH --> USERROLES`-only since Round 2. Reworded to state the diagram is already correct.
- **Three ERD attachment nodes were more abbreviated than the rest** — `ISM_TEMPLATE_ATTACHMENTS`, `MONTHLY_EXECUTED_FORM_ATTACHMENTS`, and `DRAWING_ATTACHMENTS` showed only `id`/FK/`fileName`, missing `uploadedBy` that `PROJECT_PLAN.md`'s actual schema and most other ERD attachment nodes carry. Added `uploadedBy` to all three for consistency.
- **The build-order sidebar note omitted PSC.** The "Sidebar updated as modules land" paragraph lists every module needing a new nav entry but never mentioned PSC's stub entry under COMPLIANCE. Added a one-sentence callout.
- **`PLAN_REVIEW.md`'s own Round 1 finding #1 still stated Auth as step 14** with no marker that it had been superseded. Added a one-line "superseded" note above it rather than rewriting the historical finding itself.

### Urgency check on the two Round 3 open flags

- **i18n library naming** — Cursor's assessment: not urgent yet (nothing consumes a message catalog until real translated strings ship), becomes urgent at the first screen requiring translated copy. Left open, matching that assessment.
- **Conventions "no auth, full-page forms" framing** — not urgent before Phase 2 (Postgres migration), becomes urgent when Phase 3/first Phase 5 module scaffold copies Conventions as a template. Left open, matching that assessment.

Nothing in this pass overturned a Round 2/3 fix — every finding was either a genuine gap the renumbering left behind (Reminders, the two stale prose callbacks) or a pre-existing minor inconsistency surfaced by contrast once other tables/notes got fixed (the three ERD nodes, the sidebar note).

---

## Round 5 — full fresh sweep after adding Email digest (§12b)

Asked Cursor for a complete, non-incremental read of every planning document — not a diff against prior rounds — specifically to check the newly-added Email digest feature and to catch anything in long-untouched sections that's gone stale relative to everything fixed in Rounds 1–4. Verdict on readiness: **safe to start Phase 2** (Postgres migration) — nothing found blocks that. The feature plan (through Email + RBAC + go-live) isn't fully "sealed," but nothing found requires another crisis-mode pass.

### Confirmed and fixed

- **Email recipients wrongly read as blocked on Phase 6 RBAC.** §12b and Task 5.5 said digest recipients are "Admin role (Phase 6 RBAC)" — readable as depending on the *blocked* 5-role × 3-tier permission mapping. Verified this is a real ambiguity worth clarifying, not actually a blocker: `users.role` is a real column populated from Phase 3 onward (via Settings > Users & Roles, which only needs Auth) — Phase 6 decides what each role can *do*, not whether the role *label* exists on the row. Clarified in both `PROJECT_PLAN.md` §12b and `MASTER_IMPLEMENTATION_PLAN.md` Task 5.5/the Phase 5 table so a future reader (or agent) doesn't invent a different Admin check or wait on Phase 6 unnecessarily.
- **Notifications read as a hard build dependency for Email, but isn't one.** Task 5.5 never reads or writes the `notifications` table — its only real signal is `getAlerts()`. The build-order prose, the Phase 5 table's "Depends on" column, and `module-build-order.mermaid`'s `NOTIF --> EMAIL` edge all implied otherwise. Corrected: Alerts and Settings are the hard dependencies; Notifications is thematically related (same underlying alert, different channel) and the mermaid edge is now dotted/labeled instead of a solid dependency arrow.
- **§0.9's log-userId category was hardcoded as "the two columns"** (`activity_logs.userId`, `notifications.userId`) in the Cross-cutting notes — stale the moment `email_deliveries.recipientUserId` (and really, every `uploadedBy`/`responsiblePerson`/`authorId` column) joined that category. Reworded to describe the category with examples rather than an exact, easily-outdated count.
- **Settings key for the digest toggle was unnamed** — Task 5.5 would have had an agent invent a key name. Named it `emailDigestEnabled`, following the existing `getCriticalDays()`-style typed-accessor pattern.
- **Empty-digest behavior was unspecified.** Decided and documented: skip the send entirely if there's nothing actionable that day — no "all clear" email, and it keeps `email_deliveries` rows meaning exactly one thing (a real digest went out).
- **Phase 7's checklist never mentioned email provisioning** despite Task 5.5 pointing its cron dependency there. Added a bullet covering provider account setup, SPF/DKIM/DMARC domain verification, API key as an env secret, cron wiring, and the DPA prerequisite.
- **The Alerts/Reminders/Notifications three-way split never mentioned Email** as a fourth channel. Added one sentence: Email is a delivery channel for the same Alerts signal, not a fourth store.
- **`MASTER_IMPLEMENTATION_PLAN.md`'s self-review still named Notifications as blocked/deferred** in its "what this plan excludes" line, left over from before Round 2/3 struck that from the v2 backlog. Corrected to name only the RBAC mapping as the actual blocked item.
- **`project-phases.mermaid` said "Feature build (15 modules)"** — stale once Email digest became step 16. Updated to reference the step range instead of a module count that needs updating every time scope changes.
- **Build-order item-count wording** ("16 items numbered 0–15, plus step 16") was clunky/ambiguous. Reworded to "17 items numbered 0–16" with a clarifying note that 0–15 is the core sequence and 16 was appended separately.

### Checked and found accurate (not fixed, because not actually wrong)

- **`project-phases.mermaid`'s "REMAINING: commit pending docs"** — verified via `git status`: several planning docs (`CODE_CONVENTIONS.md`, `DESIGN_HANDOFF.md`, `DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md`, `MASTER_IMPLEMENTATION_PLAN.md`, `PLAN_REVIEW.md`, `SECURITY_PLAN.md`) are genuinely untracked, and several source files are genuinely modified and uncommitted. This note is still true — not stale, despite being a plausible candidate for staleness.
- **`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md` Task 4's TopBar missing the date** — Cursor's finding here was itself stale; the date span (with its explanatory comment citing the earlier round that added it) is present in the actual `TopBar` snippet. No fix needed; flagged here so this specific claim isn't silently accepted next time it resurfaces.

### Still open, correctly assessed as non-blocking for Phase 2

`coverageAmount` integer-vs-`numeric(14,2)` type decision, theme/locale persistence wiring as a real Phase 3 checklist item, i18n catalog library naming, Conventions' pre-Auth/pre-drawer framing, RBAC nav visibility (hide/disable/403), Settings "Reports" vs. `DESIGN_HANDOFF.md` §8 gap, `vessel_types`/`flag_states` backfill as its own checkbox, magic-byte upload validation, `npm audit` in CI, `CERTIFICATES_SPEC.md` §8's historical-open-items banner, `deadweightTonnage`/`netRegisteredTonnage` as `integer` vs. the `numeric` convention used elsewhere, and `SECURITY_PLAN.md` never naming the email provider as a data processor/subprocessor (partially covered now by Phase 7's new DPA bullet, but not by a dedicated line in `SECURITY_PLAN.md` itself). None of these block Phase 2; each becomes relevant at its own later phase, same as tracked in Rounds 3–4.
