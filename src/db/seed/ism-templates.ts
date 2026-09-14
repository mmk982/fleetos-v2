/**
 * Idempotent seed for ISM template categories (`PROJECT_PLAN.md` §9).
 *
 * Six docx category names, `isCustom = false`. Accepts a Drizzle client so
 * migrate/CLI can seed without the `server-only` app pool.
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ismTemplateCategories } from "../schema";
import type * as schema from "../schema";

type Db = NodePgDatabase<typeof schema>;

/** Exact wording from required-in-details.docx §9. */
const ISM_TEMPLATE_CATEGORY_SEEDS = [
  "Drill",
  "Maintenance",
  "Safety",
  "Risk Assessment",
  "Inspection",
  "Reporting",
] as const;

/** Inserts missing seeded rows. Idempotent via unique `name`. */
export async function seedIsmTemplateReferenceData(db: Db): Promise<{
  categories: number;
}> {
  for (const name of ISM_TEMPLATE_CATEGORY_SEEDS) {
    await db
      .insert(ismTemplateCategories)
      .values({ name, isCustom: false })
      .onConflictDoNothing({ target: ismTemplateCategories.name });
  }

  return { categories: ISM_TEMPLATE_CATEGORY_SEEDS.length };
}
