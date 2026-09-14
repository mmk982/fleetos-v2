/**
 * Idempotent seed for drawing categories (`PROJECT_PLAN.md` §11).
 *
 * Six docx category names, `isCustom = false`. Accepts a Drizzle client so
 * migrate/CLI can seed without the `server-only` app pool.
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drawingCategories } from "../schema";
import type * as schema from "../schema";

type Db = NodePgDatabase<typeof schema>;

/** Exact wording from required-in-details.docx §11. */
const DRAWING_CATEGORY_SEEDS = [
  "General Arrangement",
  "Fire Control Plan",
  "Electrical",
  "Machinery",
  "Piping",
  "Safety",
] as const;

/** Inserts missing seeded rows. Idempotent via unique `name`. */
export async function seedDrawingReferenceData(db: Db): Promise<{
  categories: number;
}> {
  for (const name of DRAWING_CATEGORY_SEEDS) {
    await db
      .insert(drawingCategories)
      .values({ name, isCustom: false })
      .onConflictDoNothing({ target: drawingCategories.name });
  }

  return { categories: DRAWING_CATEGORY_SEEDS.length };
}
