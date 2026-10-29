import { notFound } from "next/navigation";
import { EditManualDrawer } from "@/components/edit-manual-drawer";
import { getManualById } from "@/modules/manuals/manual.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";
import ManualDetailPage from "../page";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditManualPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  let manual;
  let vessels;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    manual = await getManualById(access, id);
    vessels = await listSelectableVessels(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }
  if (!manual) notFound();

  return (
    <>
      <ManualDetailPage params={props.params} />
      <EditManualDrawer manual={manual} vessels={vessels} />
    </>
  );
}
