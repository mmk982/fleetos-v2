import { notFound } from "next/navigation";
import { EditCrewDrawer } from "@/components/edit-crew-drawer";
import {
  getCrewMemberById,
  listCrewCategories,
} from "@/modules/crew/crew.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import CrewDetailPage from "../page";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditCrewPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  const [member, vessels, categories] = await Promise.all([
    getCrewMemberById(access, id),
    listSelectableVessels(access),
    listCrewCategories(access),
  ]);
  if (!member) notFound();

  return (
    <>
      <CrewDetailPage params={props.params} />
      <EditCrewDrawer
        member={member}
        vessels={vessels}
        categories={categories}
      />
    </>
  );
}
