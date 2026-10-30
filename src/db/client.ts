/**
 * Database connection singleton.
 *
 * `server-only` — this file (and everything that imports it) can never end
 * up in a client bundle; it's the sole place `pg` / the connection pool gets
 * touched. Controllers call {@link getDb()} for queries; request-scoped
 * work that touches RLS-protected tables must run inside {@link withDb} or
 * {@link withSystemDb} so `SET LOCAL` session vars are visible to policies.
 *
 * PostgreSQL via `drizzle-orm/node-postgres` + a shared `pg.Pool` against
 * `DATABASE_URL` (runtime role `fleetos_app`). Migrations use
 * `DATABASE_MIGRATE_URL` (owner) via `scripts/migrate.ts` — not this pool.
 *
 * RLS (phase 1): {@link withDb} begins a transaction, sets
 * `app.user_id` / `app.role` / `app.vessel_id` with `set_config(..., true)`
 * (transaction-local), runs `fn` with AsyncLocalStorage so nested
 * {@link getDb}() / {@link withDb}() reuse the same client (no second
 * checkout), then COMMIT/ROLLBACK and releases the client.
 */
import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool, type PoolClient } from "pg";
import { ForbiddenError, type AccessContext } from "@/lib/auth/access";
import { isPgRlsViolation } from "@/lib/db/pg-errors";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./urls";

/** Drizzle client bound to a Pool or a checked-out PoolClient. */
export type AppDb = ReturnType<typeof drizzle<typeof schema>>;

type RlsLocals = {
  userId: string;
  role: string;
  vesselId: string;
};

type DbStore = {
  db: AppDb;
  client: PoolClient;
  locals: RlsLocals;
};

const dbStore = new AsyncLocalStorage<DbStore>();

let pool: Pool | null = null;
let dbInstance: AppDb | null = null;
let productionRoleChecked = false;

function localsFromContext(ctx: AccessContext): RlsLocals {
  return {
    userId: ctx.userId ?? "",
    role: ctx.role ?? "",
    vesselId: ctx.vesselId ?? "",
  };
}

function localsEqual(a: RlsLocals, b: RlsLocals): boolean {
  return (
    a.userId === b.userId && a.role === b.role && a.vesselId === b.vesselId
  );
}

async function applyRlsLocals(
  client: PoolClient,
  locals: RlsLocals,
): Promise<void> {
  await client.query("SELECT set_config($1, $2, true)", [
    "app.user_id",
    locals.userId,
  ]);
  await client.query("SELECT set_config($1, $2, true)", [
    "app.role",
    locals.role,
  ]);
  await client.query("SELECT set_config($1, $2, true)", [
    "app.vessel_id",
    locals.vesselId,
  ]);
}

/**
 * Production guard: the runtime pool must not be a superuser / BYPASSRLS
 * role (those skip RLS). No-op unless `NODE_ENV === "production"`.
 * Exported for unit tests with a mocked query fn.
 */
export async function assertProductionRuntimeRole(
  query: (text: string) => Promise<{ rows: Array<Record<string, unknown>> }>,
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const result = await query(
    "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user",
  );
  const row = result.rows[0] as
    | { rolsuper?: boolean; rolbypassrls?: boolean }
    | undefined;
  if (!row || row.rolsuper === true || row.rolbypassrls === true) {
    throw new Error("runtime must use fleetos_app");
  }
}

async function ensureProductionRuntimeRole(poolClient: Pool): Promise<void> {
  if (process.env.NODE_ENV !== "production" || productionRoleChecked) {
    return;
  }
  const client = await poolClient.connect();
  try {
    await assertProductionRuntimeRole((text) => client.query(text));
    productionRoleChecked = true;
  } finally {
    client.release();
  }
}

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: resolveDatabaseUrl() });
  }
  return pool;
}

/**
 * Returns the request-scoped Drizzle client when inside {@link withDb} /
 * {@link withSystemDb}, otherwise the shared pooled client (no RLS
 * session vars — policies fail closed for protected tables).
 */
export function getDb(): AppDb {
  const fromStore = dbStore.getStore();
  if (fromStore) {
    return fromStore.db;
  }

  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = drizzle(getPool(), { schema });
  return dbInstance;
}

/**
 * Runs `fn` under a SAVEPOINT when already inside {@link withDb}, so a
 * failed statement can be rolled back without poisoning the outer
 * transaction (needed for fire-and-forget writers like access logs).
 * Top-level (no store): runs `fn` as-is.
 */
export async function withSavepoint<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const store = dbStore.getStore();
  if (!store) {
    return fn();
  }
  const sp = `sp_${name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40)}`;
  await store.client.query(`SAVEPOINT ${sp}`);
  try {
    const result = await fn();
    await store.client.query(`RELEASE SAVEPOINT ${sp}`);
    return result;
  } catch (error) {
    await store.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    throw error;
  }
}

async function runWithClient<T>(
  locals: RlsLocals,
  fn: (db: AppDb) => Promise<T>,
): Promise<T> {
  const existing = dbStore.getStore();
  if (existing) {
    if (!localsEqual(existing.locals, locals)) {
      await applyRlsLocals(existing.client, locals);
      existing.locals = locals;
    }
    return fn(existing.db);
  }

  const p = getPool();
  await ensureProductionRuntimeRole(p);
  const client = await p.connect();
  const txDb = drizzle(client, { schema }) as unknown as AppDb;
  const store: DbStore = { db: txDb, client, locals };
  try {
    await client.query("BEGIN");
    await applyRlsLocals(client, locals);
    try {
      const result = await dbStore.run(store, () => fn(txDb));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      // RLS WITH CHECK / privilege denials surface as SQLSTATE 42501 after
      // module checks; map to ForbiddenError so API/actions return 403.
      if (isPgRlsViolation(error)) {
        throw new ForbiddenError(
          "Database policy denied this operation.",
        );
      }
      throw error;
    }
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` inside a transaction with RLS session vars for the caller.
 * Values are bound as parameters (never string-concatenated).
 * Nested calls reuse the outer transaction (one pool client).
 */
export async function withDb<T>(
  ctx: AccessContext,
  fn: (db: AppDb) => Promise<T>,
): Promise<T> {
  return runWithClient(localsFromContext(ctx), fn);
}

/**
 * Narrow system path for pre-auth / cron work that must read RLS tables
 * without a user session. Policies allow `app.role = 'system'` only for
 * the SELECT surface those jobs need — not a BYPASSRLS grant.
 *
 * Legitimate reasons (keep this list short):
 * - `email-digest` — Admin digest aggregates certificates + crew certs
 * - `notification-sync` — fan-out inserts for all active users
 * - `integration-test` — harness only
 */
export async function withSystemDb<T>(
  reason: "email-digest" | "integration-test" | "notification-sync",
  fn: (db: AppDb) => Promise<T>,
): Promise<T> {
  void reason;
  return runWithClient(
    { userId: "", role: "system", vesselId: "" },
    fn,
  );
}

/**
 * Reads current transaction-local RLS settings (for unit / integration
 * tests). Uses `true` missing-ok so unset keys return empty string.
 */
export async function readRlsSettings(db: AppDb = getDb()): Promise<{
  userId: string;
  role: string;
  vesselId: string;
}> {
  const rows = await db.execute(sql`
    SELECT
      current_setting('app.user_id', true) AS user_id,
      current_setting('app.role', true) AS role,
      current_setting('app.vessel_id', true) AS vessel_id
  `);
  const row = rows.rows[0] as
    | { user_id: string | null; role: string | null; vessel_id: string | null }
    | undefined;
  return {
    userId: row?.user_id ?? "",
    role: row?.role ?? "",
    vesselId: row?.vessel_id ?? "",
  };
}

/** Closes the pool and clears the singleton — used by tests / scripts, not app request paths. */
export async function closeDb() {
  await pool?.end();
  pool = null;
  dbInstance = null;
  productionRoleChecked = false;
}
