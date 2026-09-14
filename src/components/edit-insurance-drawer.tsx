"use client";

import { useRouter } from "next/navigation";
import { InsuranceForm } from "@/components/insurance-form";
import { Drawer } from "@/components/ui/drawer";
import type { InsurancePolicyRow, VesselRow } from "@/db/schema";

export function EditInsuranceDrawer({
  policy,
  vessels,
}: {
  policy: InsurancePolicyRow;
  vessels: VesselRow[];
}) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.push(`/dashboard/insurance/${policy.id}`)}
      title="Edit policy"
    >
      <InsuranceForm
        mode="edit"
        policyId={policy.id}
        defaultValues={policy}
        vessels={vessels}
        onCancelHref={`/dashboard/insurance/${policy.id}`}
      />
    </Drawer>
  );
}
