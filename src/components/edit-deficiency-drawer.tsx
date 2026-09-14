"use client";

import { useRouter } from "next/navigation";
import { DeficiencyForm } from "@/components/deficiency-form";
import { Drawer } from "@/components/ui/drawer";
import type { DeficiencyRow, VesselRow } from "@/db/schema";

export function EditDeficiencyDrawer({
  deficiency,
  vessels,
}: {
  deficiency: DeficiencyRow;
  vessels: VesselRow[];
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
      />
    </Drawer>
  );
}
