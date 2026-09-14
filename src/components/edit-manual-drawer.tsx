"use client";

import { useRouter } from "next/navigation";
import { ManualForm } from "@/components/manual-form";
import { Drawer } from "@/components/ui/drawer";
import type { ManualRow, VesselRow } from "@/db/schema";

export function EditManualDrawer({
  manual,
  vessels,
}: {
  manual: ManualRow;
  vessels: VesselRow[];
}) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.push(`/dashboard/manuals/${manual.id}`)}
      title="Edit manual"
    >
      <ManualForm
        mode="edit"
        manualId={manual.id}
        defaultValues={manual}
        vessels={vessels}
        onCancelHref={`/dashboard/manuals/${manual.id}`}
      />
    </Drawer>
  );
}
