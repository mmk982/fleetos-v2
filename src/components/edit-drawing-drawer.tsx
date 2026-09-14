"use client";

import { useRouter } from "next/navigation";
import { DrawingForm } from "@/components/drawing-form";
import { Drawer } from "@/components/ui/drawer";
import type {
  DrawingCategoryRow,
  DrawingRow,
  VesselRow,
} from "@/db/schema";

export function EditDrawingDrawer({
  drawing,
  vessels,
  categories,
}: {
  drawing: DrawingRow;
  vessels: VesselRow[];
  categories: DrawingCategoryRow[];
}) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.push(`/dashboard/drawings/${drawing.id}`)}
      title="Edit drawing"
    >
      <DrawingForm
        mode="edit"
        drawingId={drawing.id}
        defaultValues={drawing}
        vessels={vessels}
        categories={categories}
        onCancelHref={`/dashboard/drawings/${drawing.id}`}
      />
    </Drawer>
  );
}
