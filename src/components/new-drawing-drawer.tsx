"use client";

import { useRouter } from "next/navigation";
import { DrawingForm } from "@/components/drawing-form";
import { Drawer } from "@/components/ui/drawer";
import type { DrawingCategoryRow, VesselRow } from "@/db/schema";

export function NewDrawingDrawer({
  vessels,
  categories,
}: {
  vessels: VesselRow[];
  categories: DrawingCategoryRow[];
}) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.push("/dashboard/drawings")}
      title="Add drawing"
    >
      <DrawingForm
        mode="create"
        vessels={vessels}
        categories={categories}
        onCancelHref="/dashboard/drawings"
      />
    </Drawer>
  );
}
