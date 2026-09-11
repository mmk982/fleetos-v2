/**
 * LTR-isolate wrapper for identifiers that must not reorder in RTL layouts.
 *
 * Vessel names, IMO numbers, certificate/policy numbers, and file names are
 * always LTR even when the page `dir` is `rtl` (`DESIGN_HANDOFF.md` §5 /
 * DESIGN_SYSTEM_IMPLEMENTATION_PLAN.md Task 3). Without `unicode-bidi:
 * isolate`, mixed Arabic/Latin strings garble.
 */
import type { ReactNode } from "react";

/** Renders children in an LTR isolated span so RTL page direction cannot reorder them. */
export function Identifier({ children }: { children: ReactNode }) {
  return (
    <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>{children}</span>
  );
}
