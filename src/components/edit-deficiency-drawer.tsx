"use client";

import { useRouter } from "next/navigation";
import { DeficiencyForm } from "@/components/deficiency-form";
import { Drawer } from "@/components/ui/drawer";
import type {
  DeficiencyRow,
  DeficiencySourceRow,
  VesselRow,
} from "@/db/schema";
import type { PscInspectionListItem } from "@/modules/psc/psc.model";

export function EditDeficiencyDrawer({
  deficiency,
  vessels,
  sources,
  pscInspections,
}: {
  deficiency: DeficiencyRow;
  vessels: VesselRow[];
  sources: DeficiencySourceRow[];
  pscInspections: PscInspectionListItem[];
}) {
  const router = useRouter();

  return (
    <Drawer
      open
      onClose={() => router.push(`/dashboard/deficiencies/${deficiency.id}`)}
      title="Edit deficiency"
    >
      <DeficiencyForm
        mode="edit"
        deficiencyId={deficiency.id}
        defaultValues={deficiency}
        vessels={vessels}
        sources={sources}
        pscInspections={pscInspections}
      />
    </Drawer>
  );
}
