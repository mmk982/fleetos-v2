import { notFound } from "next/navigation";
import { EditDrawingDrawer } from "@/components/edit-drawing-drawer";
import {
  getDrawingById,
  listDrawingCategories,
} from "@/modules/drawings/drawing.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { noticeForPageAccessError } from "@/lib/auth/page-access-ui";
import { requireSession } from "@/lib/auth/session";
import DrawingDetailPage from "../page";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditDrawingPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  let drawing;
  let vessels;
  let categories;
  try {
    // Sequential: avoid concurrent queries on a shared withDb client.
    drawing = await getDrawingById(access, id);
    vessels = await listSelectableVessels(access);
    categories = await listDrawingCategories(access);
  } catch (error) {
    const notice = noticeForPageAccessError(error, access);
    if (notice) return notice;
    throw error;
  }
  if (!drawing) notFound();

  return (
    <>
      <DrawingDetailPage params={props.params} />
      <EditDrawingDrawer
        drawing={drawing}
        vessels={vessels}
        categories={categories}
      />
    </>
  );
}
