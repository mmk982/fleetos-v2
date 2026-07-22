import { vesselStatusEnum } from "@/db/schema";

export type { VesselRow as Vessel } from "@/db/schema";
export type { VesselStatus } from "@/db/schema";

export const VESSEL_STATUSES = vesselStatusEnum;

export function isVesselStatus(value: string): value is (typeof vesselStatusEnum)[number] {
  return (vesselStatusEnum as readonly string[]).includes(value);
}

export function formatImo(imo: number | null): string {
  if (imo === null || imo === undefined) {
    return "—";
  }
  return String(imo).padStart(7, "0");
}
