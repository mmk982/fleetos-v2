"use client";

import { useRouter } from "next/navigation";
import { AuditForm } from "@/components/audit-form";
import { Drawer } from "@/components/ui/drawer";
import type { VesselRow } from "@/db/schema";
import type { AuditListItem } from "@/modules/audits/audit.model";

export function EditAuditDrawer({
  audit,
  vessels,
}: {
  audit: AuditListItem;
  vessels: VesselRow[];
}) {
  const router = useRouter();

  return (
    <Drawer
      open
      onClose={() => router.push(`/dashboard/audits/${audit.id}`)}
      title="Edit audit"
    >
      <AuditForm
        mode="edit"
        auditId={audit.id}
        defaultValues={audit}
        vessels={vessels}
      />
    </Drawer>
  );
}
