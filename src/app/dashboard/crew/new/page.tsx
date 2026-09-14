import { NewCrewDrawer } from "@/components/new-crew-drawer";
import { listCrewCategories } from "@/modules/crew/crew.controller";
import { listVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import CrewPage from "../page";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function NewCrewPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const [vessels, categories] = await Promise.all([
    listVessels(access),
    listCrewCategories(access),
  ]);

  return (
    <>
      <CrewPage searchParams={props.searchParams} />
      <NewCrewDrawer vessels={vessels} categories={categories} />
    </>
  );
}
