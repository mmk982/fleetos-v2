import { notFound } from "next/navigation";
import { EditIsmTemplateDrawer } from "@/components/edit-ism-template-drawer";
import {
  getIsmTemplateById,
  listIsmTemplateCategories,
} from "@/modules/ism-templates/ismTemplate.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import IsmTemplateDetailPage from "../page";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditIsmTemplatePage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  const [template, categories] = await Promise.all([
    getIsmTemplateById(access, id),
    listIsmTemplateCategories(access),
  ]);
  if (!template) notFound();

  return (
    <>
      <IsmTemplateDetailPage params={props.params} />
      <EditIsmTemplateDrawer template={template} categories={categories} />
    </>
  );
}
