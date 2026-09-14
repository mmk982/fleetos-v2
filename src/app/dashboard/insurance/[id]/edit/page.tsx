import { notFound } from "next/navigation";
import { EditInsuranceDrawer } from "@/components/edit-insurance-drawer";
import { getInsurancePolicyById } from "@/modules/insurance/insurance.controller";
import { listVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import InsuranceDetailPage from "../page";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditInsurancePage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  const [policy, vessels] = await Promise.all([
    getInsurancePolicyById(access, id),
    listVessels(access),
  ]);
  if (!policy) notFound();

  return (
    <>
      <InsuranceDetailPage params={props.params} />
      <EditInsuranceDrawer policy={policy} vessels={vessels} />
    </>
  );
}
