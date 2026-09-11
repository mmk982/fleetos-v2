/**
 * Status badge primitive.
 *
 * Compliance statuses reuse {@link STATUS_STYLES} / {@link STATUS_LABELS} from
 * `src/lib/expiry` — color logic stays in the engine, not duplicated here.
 * Domain statuses that are not compliance (e.g. vessel lifecycle) pass a
 * `tone` instead; callers own the mapping (`DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md`
 * Task 5).
 */
import type { ReactNode } from "react";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  type ComplianceStatus,
} from "@/lib/expiry";

const TONE_CLASSES = {
  success: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
  danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  neutral:
    "bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
} as const;

export type StatusPillTone = keyof typeof TONE_CLASSES;

const BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-normal";

type ComplianceProps = {
  /** Live / cached compliance status — styles and default label from the expiry engine. */
  status: ComplianceStatus;
  tone?: never;
  children?: ReactNode;
};

type ToneProps = {
  status?: never;
  tone: StatusPillTone;
  children: ReactNode;
};

export type StatusPillProps = ComplianceProps | ToneProps;

/**
 * Compact status chip. Prefer `status` for expiry-engine vocabulary; use
 * `tone` when the domain maps its own enum (vessels, etc.).
 */
export function StatusPill(props: StatusPillProps) {
  if (props.status !== undefined) {
    return (
      <span className={`${BASE} ${STATUS_STYLES[props.status]}`}>
        {props.children ?? STATUS_LABELS[props.status]}
      </span>
    );
  }

  return (
    <span className={`${BASE} ${TONE_CLASSES[props.tone]}`}>{props.children}</span>
  );
}
