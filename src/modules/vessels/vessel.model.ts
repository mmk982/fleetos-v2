/**
 * Vessel domain types and presentation helpers.
 *
 * No database access here (that's `vessel.controller.ts`) and no server-only
 * import — this file is safe to import from client components (e.g.
 * `vessel-form.tsx`), which is why `formatImo` and `VESSEL_STATUSES` live
 * here rather than in the controller.
 */
import { vesselStatusEnum } from "@/db/schema";

export type { VesselRow as Vessel } from "@/db/schema";
export type { VesselStatus } from "@/db/schema";

/** The full set of valid vessel statuses, for `<select>` options etc. */
export const VESSEL_STATUSES = vesselStatusEnum;

/** Type guard narrowing an arbitrary string to `VesselStatus`. */
export function isVesselStatus(value: string): value is (typeof vesselStatusEnum)[number] {
  return (vesselStatusEnum as readonly string[]).includes(value);
}

/**
 * Formats an IMO number for display, zero-padded to 7 digits (the fixed
 * length of a real IMO number per IMO convention) — e.g. `1234567`, or
 * `0012345` if a shorter value is ever stored. Returns an em dash when the
 * vessel has no IMO number on file.
 */
export function formatImo(imo: number | null): string {
  if (imo === null || imo === undefined) {
    return "—";
  }
  return String(imo).padStart(7, "0");
}
