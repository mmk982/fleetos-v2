"use client";

import { useRouter } from "next/navigation";
import { InsuranceForm } from "@/components/insurance-form";
import { Drawer } from "@/components/ui/drawer";
import type { VesselRow } from "@/db/schema";

export function NewInsuranceDrawer({ vessels }: { vessels: VesselRow[] }) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.push("/dashboard/insurance")}
      title="Add policy"
    >
      <InsuranceForm
        mode="create"
        vessels={vessels}
        onCancelHref="/dashboard/insurance"
      />
    </Drawer>
  );
}
