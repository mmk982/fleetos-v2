import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { resolveMigrateDatabaseUrl } from "../src/db/urls";
import { seedCertificateReferenceData } from "../src/db/seed/certificates";
import { seedCrewReferenceData } from "../src/db/seed/crew";
import { seedDrawingReferenceData } from "../src/db/seed/drawings";
import { seedIsmTemplateReferenceData } from "../src/db/seed/ism-templates";
import { ensureAppRoleGrants } from "./ensure-app-role";

async function main() {
  const { url: connectionString, usedFallback } = resolveMigrateDatabaseUrl();
  if (usedFallback) {
    console.log(
      "db:migrate: DATABASE_MIGRATE_URL unset — falling back to DATABASE_URL (or local owner default).",
    );
  }

  await ensureAppRoleGrants(connectionString);

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("Migrations applied.");

    // Re-apply grants for any tables created by this migrate run.
    await ensureAppRoleGrants(connectionString);

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

    const drawingResult = await seedDrawingReferenceData(db);
    console.log(
      `Drawing seed: up to ${drawingResult.categories} categories (idempotent).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
