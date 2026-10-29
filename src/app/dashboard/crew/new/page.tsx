import { redirect } from "next/navigation";
import { NewCrewDrawer } from "@/components/new-crew-drawer";
import { listCrewCategories } from "@/modules/crew/crew.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { getModuleAccess } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import type { UserRole } from "@/db/schema";
import CrewPage from "../page";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function NewCrewPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  if (getModuleAccess(access.role as UserRole | null, "crew") !== "write") {
    redirect("/dashboard/crew");
  }

  const [vessels, categories] = await Promise.all([
    listSelectableVessels(access),
    listCrewCategories(access),
  ]);

  return (
    <>
      <CrewPage searchParams={props.searchParams} />
      <NewCrewDrawer vessels={vessels} categories={categories} />
    </>
  );
}
