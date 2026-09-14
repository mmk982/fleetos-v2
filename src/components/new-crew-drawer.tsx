"use client";

import { useRouter } from "next/navigation";
import { CrewForm } from "@/components/crew-form";
import { Drawer } from "@/components/ui/drawer";
import type { CrewCategoryRow, VesselRow } from "@/db/schema";

export function NewCrewDrawer({
  vessels,
  categories,
}: {
  vessels: VesselRow[];
  categories: CrewCategoryRow[];
}) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.push("/dashboard/crew")}
      title="Add crew member"
    >
      <CrewForm
        mode="create"
        vessels={vessels}
        categories={categories}
        onCancelHref="/dashboard/crew"
      />
    </Drawer>
  );
}
