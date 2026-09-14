import { NewDrawingDrawer } from "@/components/new-drawing-drawer";
import { listDrawingCategories } from "@/modules/drawings/drawing.controller";
import { listVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import DrawingsPage from "../page";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function NewDrawingPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const [vessels, categories] = await Promise.all([
    listVessels(access),
    listDrawingCategories(access),
  ]);

  return (
    <>
      <DrawingsPage searchParams={props.searchParams} />
      <NewDrawingDrawer vessels={vessels} categories={categories} />
    </>
  );
}
