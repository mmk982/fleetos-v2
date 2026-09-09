/**
 * Database connection singleton.
 *
 * `server-only` — this file (and everything that imports it) can never end
 * up in a client bundle; it's the sole place `pg` / the connection pool gets
 * touched. Every module's `<singular>.controller.ts` calls `getDb()`, never
 * opens its own connection.
 *
 * PostgreSQL via `drizzle-orm/node-postgres` + a shared `pg.Pool` against
 * `DATABASE_URL` (`MASTER_PLAN.md` Phase 2 / `MASTER_IMPLEMENTATION_PLAN.md`
 * Task 2.1). Callers keep using `getDb()`; the sync→async change lives in
 * each controller's query methods, not in this signature.
 *
 * RLS groundwork (Phase 4/6): policies will need per-request
 * `SET LOCAL app.user_id` / `app.role` inside a transaction. Today's
 * `getDb()` returns the pooled client — leave room for a future
 * `withDb(ctx, fn)` (or equivalent) that begins a transaction, sets session
 * vars, runs `fn`, and commits, rather than hard-wiring every controller to
 * a shape that can't grow that wrapper. Do not add RLS here until Phase 6
 * role data exists.
 */
import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const defaultDatabaseUrl = "postgres://fleetos:fleetos@localhost:5433/fleetos";

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Resolves `DATABASE_URL`, falling back to the local Docker Compose default. */
function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || defaultDatabaseUrl;
}

/**
 * Returns the shared Drizzle client, opening the underlying pool on first
 * call and reusing it afterward (module-scoped singleton — Next.js
 * dev-mode module reloads aside, this avoids re-creating the pool on every
 * request).
 */
export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  pool = new Pool({ connectionString: resolveDatabaseUrl() });
  dbInstance = drizzle(pool, { schema });
  return dbInstance;
}

/** Closes the pool and clears the singleton — used by tests / scripts, not app request paths. */
export async function closeDb() {
  await pool?.end();
  pool = null;
  dbInstance = null;
}
