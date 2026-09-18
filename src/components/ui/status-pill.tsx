/**
 * Status badge primitive — bordered, rounded-full Pill (prior FleetOS design).
 *
 * Compliance statuses reuse {@link STATUS_STYLES} / {@link STATUS_LABELS} from
 * `src/lib/expiry`. Domain statuses that are not compliance pass a `tone`.
 */
import type { ReactNode } from "react";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  type ComplianceStatus,
} from "@/lib/expiry";

const TONE_CLASSES = {
  success:
    "bg-[color-mix(in_oklab,var(--success)_10%,white)] text-[var(--success)] border-[color-mix(in_oklab,var(--success)_25%,white)] dark:bg-[var(--success)]/20 dark:border-[var(--success)]/40 dark:text-[var(--success)]",
  warning:
    "bg-[color-mix(in_oklab,var(--warning)_10%,white)] text-[var(--warning)] border-[color-mix(in_oklab,var(--warning)_25%,white)] dark:bg-[var(--warning)]/20 dark:border-[var(--warning)]/40 dark:text-[var(--warning)]",
  danger:
    "bg-[color-mix(in_oklab,var(--error)_10%,white)] text-[var(--error)] border-[color-mix(in_oklab,var(--error)_25%,white)] dark:bg-[var(--error)]/20 dark:border-[var(--error)]/40 dark:text-[var(--error)]",
  neutral:
    "bg-[var(--tone-slate-bg)] text-[var(--tone-slate-fg)] border-[var(--border-strong)]",
} as const;

export type StatusPillTone = keyof typeof TONE_CLASSES;

const BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

const DOT_BY_STATUS: Partial<Record<ComplianceStatus, string>> = {
  valid: "bg-[var(--success)]",
  expiring: "bg-[var(--warning)]",
  critical: "bg-[var(--warning)]",
  expired: "bg-[var(--error)]",
  unknown: "bg-[var(--text-muted)]",
  revoked: "bg-[var(--text-muted)]",
};

const DOT_BY_TONE: Record<StatusPillTone, string> = {
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--error)]",
  neutral: "bg-[var(--text-muted)]",
};

type ComplianceProps = {
  status: ComplianceStatus;
  tone?: never;
  children?: ReactNode;
  /** Leading status dot (default true for compliance pills). */
  dot?: boolean;
};

type ToneProps = {
  status?: never;
  tone: StatusPillTone;
  children: ReactNode;
  dot?: boolean;
};

export type StatusPillProps = ComplianceProps | ToneProps;

/**
 * Compact status chip. Prefer `status` for expiry-engine vocabulary; use
 * `tone` when the domain maps its own enum (vessels, etc.).
 */
export function StatusPill(props: StatusPillProps) {
  if (props.status !== undefined) {
    const showDot = props.dot !== false;
    return (
      <span className={`${BASE} ${STATUS_STYLES[props.status]}`}>
        {showDot ? (
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_BY_STATUS[props.status] ?? "bg-[var(--text-muted)]"}`}
            aria-hidden="true"
          />
        ) : null}
        {props.children ?? STATUS_LABELS[props.status]}
      </span>
    );
  }

  const showDot = props.dot === true;
  return (
    <span className={`${BASE} ${TONE_CLASSES[props.tone]}`}>
      {showDot ? (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_BY_TONE[props.tone]}`}
          aria-hidden="true"
        />
      ) : null}
      {props.children}
    </span>
  );
}
