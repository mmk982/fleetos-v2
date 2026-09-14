"use client";

import { useRouter } from "next/navigation";
import { ManualForm } from "@/components/manual-form";
import { Drawer } from "@/components/ui/drawer";
import type { VesselRow } from "@/db/schema";

export function NewManualDrawer({ vessels }: { vessels: VesselRow[] }) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.push("/dashboard/manuals")}
      title="Add manual"
    >
      <ManualForm
        mode="create"
        vessels={vessels}
        onCancelHref="/dashboard/manuals"
      />
    </Drawer>
  );
}
