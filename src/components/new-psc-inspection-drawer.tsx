"use client";

import { useRouter } from "next/navigation";
import { PscInspectionForm } from "@/components/psc-inspection-form";
import { Drawer } from "@/components/ui/drawer";
import type { VesselRow } from "@/db/schema";

export function NewPscInspectionDrawer({ vessels }: { vessels: VesselRow[] }) {
  const router = useRouter();

  return (
    <Drawer
      open
      onClose={() => router.push("/dashboard/psc")}
      title="New PSC inspection"
    >
      <PscInspectionForm mode="create" vessels={vessels} />
    </Drawer>
  );
}
