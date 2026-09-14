"use client";

import { useRouter } from "next/navigation";
import { IsmTemplateForm } from "@/components/ism-template-form";
import { Drawer } from "@/components/ui/drawer";
import type { IsmTemplateCategoryRow } from "@/db/schema";

export function NewIsmTemplateDrawer({
  categories,
}: {
  categories: IsmTemplateCategoryRow[];
}) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.push("/dashboard/ism-templates")}
      title="Add template"
    >
      <IsmTemplateForm
        mode="create"
        categories={categories}
        onCancelHref="/dashboard/ism-templates"
      />
    </Drawer>
  );
}
