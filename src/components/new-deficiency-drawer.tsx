"use client";

import { useRouter } from "next/navigation";
import { DeficiencyForm } from "@/components/deficiency-form";
import { Drawer } from "@/components/ui/drawer";
import type { DeficiencySourceRow, VesselRow } from "@/db/schema";
import type { PscInspectionListItem } from "@/modules/psc/psc.model";

export function NewDeficiencyDrawer({
  vessels,
  sources,
  pscInspections,
}: {
  vessels: VesselRow[];
  sources: DeficiencySourceRow[];
  pscInspections: PscInspectionListItem[];
}) {
  const router = useRouter();

  return (
    <Drawer
      open
      onClose={() => router.push("/dashboard/deficiencies")}
      title="New deficiency"
    >
      <DeficiencyForm
        mode="create"
        vessels={vessels}
        sources={sources}
        pscInspections={pscInspections}
      />
    </Drawer>
  );
}
