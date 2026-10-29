import { notFound } from "next/navigation";
import { EditInsuranceDrawer } from "@/components/edit-insurance-drawer";
import { getInsurancePolicyById } from "@/modules/insurance/insurance.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";
import InsuranceDetailPage from "../page";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditInsurancePage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  let policy;
  let vessels;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    policy = await getInsurancePolicyById(access, id);
    vessels = await listSelectableVessels(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }
  if (!policy) notFound();

  return (
    <>
      <InsuranceDetailPage params={props.params} />
      <EditInsuranceDrawer policy={policy} vessels={vessels} />
    </>
  );
}
