import { NewDrawingDrawer } from "@/components/new-drawing-drawer";
import { listDrawingCategories } from "@/modules/drawings/drawing.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";
import DrawingsPage from "../page";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function NewDrawingPage(props: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const access = toAccessContext(session);

  let vessels;
  let categories;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    vessels = await listSelectableVessels(access);
    categories = await listDrawingCategories(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }

  return (
    <>
      <DrawingsPage searchParams={props.searchParams} />
      <NewDrawingDrawer vessels={vessels} categories={categories} />
    </>
  );
}
