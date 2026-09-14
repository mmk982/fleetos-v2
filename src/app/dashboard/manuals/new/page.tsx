import { NewManualDrawer } from "@/components/new-manual-drawer";
import { listVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import ManualsPage from "../page";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function NewManualPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const vessels = await listVessels(toAccessContext(session));

  return (
    <>
      <ManualsPage searchParams={props.searchParams} />
      <NewManualDrawer vessels={vessels} />
    </>
  );
}
