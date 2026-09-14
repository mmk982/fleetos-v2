"use client";

import { useRouter } from "next/navigation";
import { DeficiencyForm } from "@/components/deficiency-form";
import { Drawer } from "@/components/ui/drawer";
import type { VesselRow } from "@/db/schema";

export function NewDeficiencyDrawer({ vessels }: { vessels: VesselRow[] }) {
  const router = useRouter();

  return (
    <Drawer
      open
      onClose={() => router.push("/dashboard/deficiencies")}
      title="New deficiency"
    >
      <DeficiencyForm mode="create" vessels={vessels} />
    </Drawer>
  );
}
