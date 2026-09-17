"use client";

import { Button } from "@/components/ui/button";
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
        <Button variant="primary" type="button"
          onClick={() => setMode({ kind: "create-current" })}>
          {current ? "Add new current record" : "Add particulars"}
        </Button>
        {current ? (
          <Button variant="secondary" type="button"
            onClick={() => setMode({ kind: "edit-inplace", row: current })}>
            Edit current in place
          </Button>
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
