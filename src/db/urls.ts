/**
 * Database URL helpers shared by the app pool and migrate scripts.
 * Not `server-only` — migrate scripts import this outside Next.
 */

const defaultOwnerUrl =
  "postgres://fleetos:fleetos@localhost:5433/fleetos";

const defaultAppUrl =
  "postgres://fleetos_app:fleetos_app@localhost:5433/fleetos";

/**
 * Runtime app connection (RLS-enforced role). Falls back to the local
 * `fleetos_app` URL; if that role does not exist yet, operators still use
 * the owner URL temporarily via `DATABASE_URL`.
 */
export function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || defaultAppUrl;
}

/**
 * Owner / migrate connection. Falls back to `DATABASE_URL`, then the local
 * Docker owner default. Logs when falling back so misconfigured prod is visible.
 */
export function resolveMigrateDatabaseUrl(): {
  url: string;
  usedFallback: boolean;
} {
  const migrate = process.env.DATABASE_MIGRATE_URL?.trim();
  if (migrate) {
    return { url: migrate, usedFallback: false };
  }
  const runtime = process.env.DATABASE_URL?.trim();
  if (runtime) {
    return { url: runtime, usedFallback: true };
  }
  return { url: defaultOwnerUrl, usedFallback: true };
}

export { defaultAppUrl, defaultOwnerUrl };
