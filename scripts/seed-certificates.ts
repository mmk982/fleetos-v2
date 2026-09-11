/**
 * CLI runner for certificate reference-data seed (re-seed without migrate).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { seedCertificateReferenceData } from "../src/db/seed/certificates";

const defaultDatabaseUrl = "postgres://fleetos:fleetos@localhost:5433/fleetos";

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim() || defaultDatabaseUrl;
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  try {
    const result = await seedCertificateReferenceData(db);
    console.log(
      `Seeded up to ${result.authorities} issuing authorities and ${result.types} certificate types (idempotent).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Certificate seed failed:", error);
  process.exit(1);
});
