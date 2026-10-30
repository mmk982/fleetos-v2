/**
 * Ensures local/runtime role `fleetos_app` exists and can use the schema.
 * Safe to re-run. Uses the migrate/owner URL (superuser locally).
 *
 * Local default password is `fleetos_app`. Production: set
 * `FLEETOS_APP_PASSWORD` (never commit) so CREATE ROLE uses that secret;
 * if the role already exists, this script only applies grants (docs/RLS.md).
 *
 * Import {@link ensureAppRoleGrants} from migrate / tests. Running this
 * file directly via `npx tsx scripts/ensure-app-role.ts` also works.
 */
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { resolveMigrateDatabaseUrl } from "../src/db/urls";

const LOCAL_APP_PASSWORD = "fleetos_app";

function quoteIdent(ident: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident)) {
    throw new Error(`Refusing to GRANT on unsafe database name: ${ident}`);
  }
  return `"${ident}"`;
}

/** Escape a value for use inside a single-quoted SQL string literal. */
function sqlStringLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/** Creates `fleetos_app` (if missing) and grants table/sequence privileges. */
export async function ensureAppRoleGrants(
  connectionString: string,
): Promise<void> {
  const url = new URL(connectionString);
  const dbName =
    decodeURIComponent(url.pathname.replace(/^\//, "")) || "fleetos";
  const appPassword =
    process.env.FLEETOS_APP_PASSWORD?.trim() || LOCAL_APP_PASSWORD;
  const pool = new Pool({ connectionString });
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleetos_app') THEN
          CREATE ROLE fleetos_app LOGIN PASSWORD '${sqlStringLiteral(appPassword)}'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
        END IF;
      END
      $$;
    `);
    await pool.query(
      `GRANT CONNECT ON DATABASE ${quoteIdent(dbName)} TO fleetos_app`,
    );
    await pool.query(`GRANT USAGE ON SCHEMA public TO fleetos_app`);
    await pool.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fleetos_app`,
    );
    await pool.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fleetos_app`,
    );
    await pool.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fleetos_app
    `);
    await pool.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO fleetos_app
    `);
  } finally {
    await pool.end();
  }
}

async function main() {
  const { url: migrateUrl, usedFallback } = resolveMigrateDatabaseUrl();
  if (usedFallback) {
    console.log(
      "ensure-app-role: DATABASE_MIGRATE_URL unset — falling back to DATABASE_URL (or local owner default).",
    );
  }
  await ensureAppRoleGrants(migrateUrl);
  console.log("ensure-app-role: grants applied.");
}

const isDirectRun =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error("ensure-app-role failed:", error);
    process.exit(1);
  });
}
