import { NewInsuranceDrawer } from "@/components/new-insurance-drawer";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";
import InsurancePage from "../page";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function NewInsurancePage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);

  let vessels;
  try {
    vessels = await listSelectableVessels(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

  return (
    <>
      <InsurancePage searchParams={props.searchParams} />
      <NewInsuranceDrawer vessels={vessels} />
    </>
  );
}
