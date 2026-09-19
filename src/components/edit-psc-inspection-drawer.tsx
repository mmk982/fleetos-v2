"use client";

import { useRouter } from "next/navigation";
import { PscInspectionForm } from "@/components/psc-inspection-form";
import { Drawer } from "@/components/ui/drawer";
import type { VesselRow } from "@/db/schema";
import type { PscInspectionListItem } from "@/modules/psc/psc.model";

export function EditPscInspectionDrawer({
  inspection,
  vessels,
}: {
  inspection: PscInspectionListItem;
  vessels: VesselRow[];
}) {
  const router = useRouter();

  return (
    <Drawer
      open
      onClose={() => router.push(`/dashboard/psc/${inspection.id}`)}
      title="Edit PSC inspection"
    >
      <PscInspectionForm
        mode="edit"
        inspectionId={inspection.id}
        defaultValues={inspection}
        vessels={vessels}
      />
    </Drawer>
  );
}
