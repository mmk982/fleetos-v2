/**
 * Expiry / Reminder Engine — pure compliance-status derivation.
 *
 * Date-derived, authoritative at read time. Every consumer (Certificates,
 * Crew, Insurance, Deficiencies, Alerts) supplies a per-item reminder rule
 * and dates; this module never touches the database, Settings, React, or
 * `server-only`, so controllers and tests can import it freely.
 *
 * Spec: PROJECT_PLAN.md "Shared building block: the Expiry / Reminder Engine".
 *
 * Boundary: no I/O. Callers resolve `criticalDays` one layer up (via
 * `getCriticalDays()` once Settings exists) and pass the number in.
 */

/** Derived compliance vocabulary reused by every module and the alerts feed. */
export type ComplianceStatus =
  | "valid"
  | "expiring"
  | "critical"
  | "expired"
  | "unknown"
  | "revoked";

/** How a reminder fires for a given item (from certificate_types, or fixed per module). */
export type ReminderRuleKind = "none" | "expiry_offset" | "window";

/**
 * Per-item reminder rule supplied by the caller.
 *
 * `offsetDays` is only used when `kind === "expiry_offset"` (typically 30 or 180).
 */
export interface ReminderRule {
  kind: ReminderRuleKind;
  /** Days before expiry the reminder fires; ignored unless kind is `expiry_offset`. */
  offsetDays?: number | null;
}

/**
 * Input to {@link deriveComplianceStatus}.
 *
 * Dates are calendar strings (`YYYY-MM-DD`). Comparisons use UTC start-of-day
 * so time-of-day never flips a boundary.
 */
export interface ComplianceInput {
  rule: ReminderRule;
  /** Expiry / due date; required for `expiry_offset`, fallback cutoff for `window`. */
  expiryDate: string | null;
  /** Survey window open; required for `window`. */
  windowOpenDate?: string | null;
  /** Survey window close; with `expiryDate` forms the window cutoff. */
  windowCloseDate?: string | null;
  /**
   * Certificate lifecycle. Any value other than `"active"` forces `revoked`.
   * Omitted is treated as active so callers that don't track lifecycle still work.
   */
  lifecycleStatus?: "active" | "revoked" | "superseded";
  /**
   * Final-stretch escalation threshold in days. Defaults to
   * {@link DEFAULT_CRITICAL_DAYS} inside the engine — never read from Settings here.
   */
  criticalDays?: number;
  /** Injectable clock for tests; defaults to `new Date()`. */
  now?: Date;
}

/** Result of a single derivation pass. */
export interface ComplianceResult {
  status: ComplianceStatus;
  /**
   * Days from today to `expiryDate` (`expiry_offset`), or to `windowOpenDate`
   * (`window`). `null` when no reference date applies.
   */
  daysRemaining: number | null;
  /** Which date drove the result (or `"none"` for permanent / lifecycle override). */
  reference: "expiry" | "window" | "none";
}

/**
 * Default final-stretch escalation threshold (days).
 *
 * Deliberately **7, not 30** (PROJECT_PLAN.md §0.2): most certificate types use
 * a 30-day `expiry_offset`, so a 30-day critical threshold would make
 * `expiring` and `critical` fire on the same day for the majority of items,
 * collapsing the two tiers. With 7, a 30d item is `expiring` at 30 days out and
 * escalates to `critical` only in the final week.
 *
 * The engine never reads Settings. Controllers resolve
 * `stored ?? DEFAULT_CRITICAL_DAYS` via `getCriticalDays()` (§7a) and pass the
 * number in as `criticalDays` — keeping this module a pure function with no I/O.
 */
export const DEFAULT_CRITICAL_DAYS = 7;

/** Human-readable labels for badges and list cells. */
export const STATUS_LABELS: Record<ComplianceStatus, string> = {
  valid: "Valid",
  expiring: "Expiring",
  critical: "Critical",
  expired: "Expired",
  unknown: "Unknown",
  revoked: "Revoked",
};

/**
 * Tailwind badge classes mapped to DESIGN_HANDOFF.md §1.3:
 * green = valid; amber = due soon (`expiring` / `critical`); red = expired;
 * gray = unknown / revoked. `critical` shares amber with `expiring` but keeps
 * bold + ring emphasis because it is meaningfully more urgent.
 */
export const STATUS_STYLES: Record<ComplianceStatus, string> = {
  valid:
    "bg-[#EAF3DE] text-[#27500A] dark:bg-[#085041] dark:text-[#5DCAA5]",
  expiring:
    "bg-[#FAEEDA] text-[#633806] dark:bg-[#633806] dark:text-[#FAC775]",
  critical:
    "bg-[#FAEEDA] text-[#633806] font-semibold ring-1 ring-[#633806]/40 dark:bg-[#633806] dark:text-[#FAC775] dark:ring-[#FAC775]/40",
  expired:
    "bg-[#FCEBEB] text-[#791F1F] dark:bg-[#791F1F] dark:text-[#F09595]",
  unknown: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  revoked: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const SEVERITY_RANK: Record<ComplianceStatus, number> = {
  expired: 5,
  critical: 4,
  expiring: 3,
  unknown: 2,
  revoked: 1,
  valid: 0,
};

/**
 * Returns whether a status belongs on the actionable alerts feed.
 *
 * Only `expiring`, `critical`, and `expired` need operator attention.
 * `valid` is fine; `unknown` needs data entry, not a renewal action;
 * `revoked` / superseded are lifecycle states, not expiry urgency.
 */
export function isActionable(s: ComplianceStatus): boolean {
  return s === "expiring" || s === "critical" || s === "expired";
}

/**
 * Sort comparator: worst status first (expired → … → valid).
 *
 * Equal severity sorts by fewer `daysRemaining` first (sooner deadline wins);
 * `null` days sort after numeric values.
 */
export function compareBySeverity(
  a: ComplianceResult,
  b: ComplianceResult,
): number {
  const byStatus = SEVERITY_RANK[b.status] - SEVERITY_RANK[a.status];
  if (byStatus !== 0) return byStatus;
  if (a.daysRemaining === null && b.daysRemaining === null) return 0;
  if (a.daysRemaining === null) return 1;
  if (b.daysRemaining === null) return -1;
  return a.daysRemaining - b.daysRemaining;
}

const MS_PER_DAY = 86_400_000;

/** UTC calendar midnight for a Date (strips time-of-day for boundary-safe math). */
function startOfDayUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * Parses a `YYYY-MM-DD` (or ISO datetime) calendar date as UTC midnight.
 * Returns `null` for empty / unparsable input.
 */
function parseDateOnly(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const datePart = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Whole calendar days from `from` to `to` (negative if `to` is in the past). */
function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDayUTC(to).getTime() - startOfDayUTC(from).getTime()) / MS_PER_DAY,
  );
}

/**
 * Derives live compliance status from a reminder rule and dates.
 *
 * Pure: no DB, no Settings. Rules (PROJECT_PLAN.md Derivation rules):
 * 1. Non-active `lifecycleStatus` → `revoked` (overrides everything).
 * 2. `none` → always `valid`.
 * 3. `expiry_offset` thresholds on days to `expiryDate`.
 * 4. `window` thresholds on open / cutoff (`windowCloseDate ?? expiryDate`),
 *    with post-cutoff → `expired` (never `critical` on close).
 *
 * @param input - Rule, dates, optional lifecycle / criticalDays / now.
 */
export function deriveComplianceStatus(
  input: ComplianceInput,
): ComplianceResult {
  const now = startOfDayUTC(input.now ?? new Date());
  const criticalDays = input.criticalDays ?? DEFAULT_CRITICAL_DAYS;

  // Omitted lifecycle = active; only an explicit non-active value overrides.
  if (
    input.lifecycleStatus !== undefined &&
    input.lifecycleStatus !== "active"
  ) {
    return { status: "revoked", daysRemaining: null, reference: "none" };
  }

  if (input.rule.kind === "none") {
    return { status: "valid", daysRemaining: null, reference: "none" };
  }

  if (input.rule.kind === "expiry_offset") {
    return deriveExpiryOffset(input, now, criticalDays);
  }

  return deriveWindow(input, now, criticalDays);
}

function deriveExpiryOffset(
  input: ComplianceInput,
  now: Date,
  criticalDays: number,
): ComplianceResult {
  const expiry = parseDateOnly(input.expiryDate);
  if (!expiry) {
    return { status: "unknown", daysRemaining: null, reference: "expiry" };
  }

  const daysRemaining = calendarDaysBetween(now, expiry);
  const offsetDays = input.rule.offsetDays;

  let status: ComplianceStatus;
  if (daysRemaining < 0) {
    status = "expired";
  } else if (daysRemaining <= criticalDays) {
    status = "critical";
  } else if (offsetDays != null && daysRemaining <= offsetDays) {
    status = "expiring";
  } else {
    status = "valid";
  }

  return { status, daysRemaining, reference: "expiry" };
}

function deriveWindow(
  input: ComplianceInput,
  now: Date,
  criticalDays: number,
): ComplianceResult {
  const open = parseDateOnly(input.windowOpenDate ?? null);
  if (!open) {
    return { status: "unknown", daysRemaining: null, reference: "window" };
  }

  const daysRemaining = calendarDaysBetween(now, open);
  const cutoff =
    parseDateOnly(input.windowCloseDate ?? null) ??
    parseDateOnly(input.expiryDate);

  // Before the window opens.
  if (now.getTime() < open.getTime()) {
    return { status: "valid", daysRemaining, reference: "window" };
  }

  // Inside or after the window — need a cutoff to classify.
  if (!cutoff) {
    return { status: "unknown", daysRemaining, reference: "window" };
  }

  // Past the cutoff → expired (survey missed; never critical on close).
  if (now.getTime() > cutoff.getTime()) {
    return { status: "expired", daysRemaining, reference: "window" };
  }

  const daysToCutoff = calendarDaysBetween(now, cutoff);
  if (daysToCutoff <= criticalDays) {
    return { status: "critical", daysRemaining, reference: "window" };
  }

  return { status: "expiring", daysRemaining, reference: "window" };
}
