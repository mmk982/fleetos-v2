"use client";

import { useRouter } from "next/navigation";
import { AuditForm } from "@/components/audit-form";
import { Drawer } from "@/components/ui/drawer";
import type { VesselRow } from "@/db/schema";

export function NewAuditDrawer({ vessels }: { vessels: VesselRow[] }) {
  const router = useRouter();

  return (
    <Drawer
      open
      onClose={() => router.push("/dashboard/audits")}
      title="New audit"
    >
      <AuditForm mode="create" vessels={vessels} />
    </Drawer>
  );
}
