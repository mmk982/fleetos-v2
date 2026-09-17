"use client";

import { useState } from "react";
import { ParticularsForm } from "@/components/particulars-form";
import { Drawer } from "@/components/ui/drawer";
import type { VesselParticularsRow, VesselRow } from "@/db/schema";

type Mode =
  | { kind: "closed" }
  | { kind: "create-current" }
  | { kind: "edit-inplace"; row: VesselParticularsRow };

export function ParticularsVesselActions({
  vesselId,
  vessels,
  current,
}: {
  vesselId: string;
  vessels: VesselRow[];
  current: VesselParticularsRow | null;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "closed" });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode({ kind: "create-current" })}
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          {current ? "Add new current record" : "Add particulars"}
        </button>
        {current ? (
          <button
            type="button"
            onClick={() => setMode({ kind: "edit-inplace", row: current })}
            className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-primary)]"
          >
            Edit current in place
          </button>
        ) : null}
      </div>

      <Drawer
        open={mode.kind !== "closed"}
        onClose={() => setMode({ kind: "closed" })}
        title={
          mode.kind === "edit-inplace"
            ? "Edit current particulars"
            : "New current particulars"
        }
      >
        {mode.kind === "create-current" ? (
          <ParticularsForm
            mode="create"
            makeCurrent
            vessels={vessels}
            fixedVesselId={vesselId}
            onCancelHref={`/dashboard/particulars/${vesselId}`}
          />
        ) : null}
        {mode.kind === "edit-inplace" ? (
          <ParticularsForm
            mode="edit"
            particularsId={mode.row.id}
            defaultValues={mode.row}
            vessels={vessels}
            fixedVesselId={vesselId}
            onCancelHref={`/dashboard/particulars/${vesselId}`}
          />
        ) : null}
      </Drawer>
    </>
  );
}
