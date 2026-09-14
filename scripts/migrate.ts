import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { seedCertificateReferenceData } from "../src/db/seed/certificates";
import { seedCrewReferenceData } from "../src/db/seed/crew";
import { seedIsmTemplateReferenceData } from "../src/db/seed/ism-templates";

const defaultDatabaseUrl = "postgres://fleetos:fleetos@localhost:5433/fleetos";

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim() || defaultDatabaseUrl;
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("Migrations applied.");

    const certResult = await seedCertificateReferenceData(db);
    console.log(
      `Certificate seed: up to ${certResult.authorities} authorities, ${certResult.types} types (idempotent).`,
    );

    const crewResult = await seedCrewReferenceData(db);
    console.log(
      `Crew seed: up to ${crewResult.categories} categories, ${crewResult.endorsementTypes} endorsement types (idempotent).`,
    );

    const ismResult = await seedIsmTemplateReferenceData(db);
    console.log(
      `ISM template seed: up to ${ismResult.categories} categories (idempotent).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
