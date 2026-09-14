/**
 * CLI runner for ISM template category seed (re-seed without migrate).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { seedIsmTemplateReferenceData } from "../src/db/seed/ism-templates";

const defaultDatabaseUrl = "postgres://fleetos:fleetos@localhost:5433/fleetos";

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim() || defaultDatabaseUrl;
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  try {
    const result = await seedIsmTemplateReferenceData(db);
    console.log(
      `Seeded up to ${result.categories} ISM template categories (idempotent).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("ISM template seed failed:", error);
  process.exit(1);
});
