"use client";

import { useRouter } from "next/navigation";
import { IsmTemplateForm } from "@/components/ism-template-form";
import { Drawer } from "@/components/ui/drawer";
import type {
  IsmTemplateCategoryRow,
  IsmTemplateRow,
} from "@/db/schema";

export function EditIsmTemplateDrawer({
  template,
  categories,
}: {
  template: IsmTemplateRow;
  categories: IsmTemplateCategoryRow[];
}) {
  const router = useRouter();
  return (
    <Drawer
      open
      onClose={() => router.push(`/dashboard/ism-templates/${template.id}`)}
      title="Edit template"
    >
      <IsmTemplateForm
        mode="edit"
        templateId={template.id}
        defaultValues={template}
        categories={categories}
        onCancelHref={`/dashboard/ism-templates/${template.id}`}
      />
    </Drawer>
  );
}
