import { notFound } from "next/navigation";
import { EditManualDrawer } from "@/components/edit-manual-drawer";
import { getManualById } from "@/modules/manuals/manual.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import ManualDetailPage from "../page";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditManualPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  const [manual, vessels] = await Promise.all([
    getManualById(access, id),
    listSelectableVessels(access),
  ]);
  if (!manual) notFound();

  return (
    <>
      <ManualDetailPage params={props.params} />
      <EditManualDrawer manual={manual} vessels={vessels} />
    </>
  );
}
