import { NewIsmTemplateDrawer } from "@/components/new-ism-template-drawer";
import { listIsmTemplateCategories } from "@/modules/ism-templates/ismTemplate.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import IsmTemplatesPage from "../page";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function NewIsmTemplatePage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const categories = await listIsmTemplateCategories(
    toAccessContext(session),
  );

  return (
    <>
      <IsmTemplatesPage searchParams={props.searchParams} />
      <NewIsmTemplateDrawer categories={categories} />
    </>
  );
}
