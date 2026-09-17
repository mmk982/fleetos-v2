/**
 * LTR-isolate wrapper for identifiers that must not reorder in RTL layouts.
 *
 * Vessel names, IMO numbers, certificate/policy numbers, and file names are
 * always LTR even when the page `dir` is `rtl`. Optional `mono` applies
 * Fira Code for regulation codes / policy IDs / audit reference numbers
 * (ComplianceOne Do's/Don'ts #1).
 */
import type { ReactNode } from "react";

/** Renders children in an LTR isolated span so RTL page direction cannot reorder them. */
export function Identifier({
  children,
  mono = false,
}: {
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      className={mono ? "font-[var(--font-mono)]" : undefined}
      style={{ direction: "ltr", unicodeBidi: "isolate" }}
    >
      {children}
    </span>
  );
}
