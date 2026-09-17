import { notFound } from "next/navigation";
import { EditDrawingDrawer } from "@/components/edit-drawing-drawer";
import {
  getDrawingById,
  listDrawingCategories,
} from "@/modules/drawings/drawing.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import { toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import DrawingDetailPage from "../page";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditDrawingPage(props: PageProps) {
  const session = await requireSession();
  const access = toAccessContext(session);
  const { id } = await props.params;

  const [drawing, vessels, categories] = await Promise.all([
    getDrawingById(access, id),
    listSelectableVessels(access),
    listDrawingCategories(access),
  ]);
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
