import { NewInsuranceDrawer } from "@/components/new-insurance-drawer";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import InsurancePage from "../page";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function NewInsurancePage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const vessels = await listSelectableVessels(toAccessContext(session));

  return (
    <>
      <InsurancePage searchParams={props.searchParams} />
      <NewInsuranceDrawer vessels={vessels} />
    </>
  );
}
