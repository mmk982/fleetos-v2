/**
 * Idempotent seed for Crew reference tables (`PROJECT_PLAN.md` §3 / §7a).
 *
 * Values are illustrative maritime ranks / STCW-style endorsement labels —
 * Settings will own user-extensible CRUD later. Accepts a Drizzle client so
 * migrate/CLI can seed without the `server-only` app pool.
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { crewCategories, endorsementTypes } from "../schema";
import type * as schema from "../schema";

type Db = NodePgDatabase<typeof schema>;

/** Placeholder ranks — confirm with ops before production data entry. */
const CREW_CATEGORY_SEEDS = [
  "Master",
  "Chief Officer",
  "Second Officer",
  "Third Officer",
  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Bosun",
  "Able Seaman",
  "Ordinary Seaman",
  "Cook",
] as const;

/** Placeholder endorsement / document categories (nullable on certificates). */
const ENDORSEMENT_TYPE_SEEDS = [
  "STCW II/2 — Master",
  "STCW II/1 — Officer in charge of a navigational watch",
  "STCW III/2 — Chief Engineer",
  "STCW III/1 — Officer in charge of an engineering watch",
  "STCW VI/1 — Basic Safety Training",
  "GMDSS GOC",
  "ENG1 Medical",
  "Passport",
  "Seaman's Book",
  "Visa",
] as const;

/** Inserts missing seeded rows. Idempotent via unique `name`. */
export async function seedCrewReferenceData(db: Db): Promise<{
  categories: number;
  endorsementTypes: number;
}> {
  for (const name of CREW_CATEGORY_SEEDS) {
    await db
      .insert(crewCategories)
      .values({ name, isCustom: false })
      .onConflictDoNothing({ target: crewCategories.name });
  }

  for (const name of ENDORSEMENT_TYPE_SEEDS) {
    await db
      .insert(endorsementTypes)
      .values({ name, isCustom: false })
      .onConflictDoNothing({ target: endorsementTypes.name });
  }

  return {
    categories: CREW_CATEGORY_SEEDS.length,
    endorsementTypes: ENDORSEMENT_TYPE_SEEDS.length,
  };
}
