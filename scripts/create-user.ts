/**
 * One-off bootstrap script — creates the first user row so `/login` can be
 * tested end-to-end. Not an app feature (v1 has no self-service signup,
 * per `PROJECT_PLAN.md` §7a — Admin sets passwords directly). Same
 * "documented script, not a UI feature" treatment as the break-glass
 * recovery script in `SECURITY_PLAN.md` §2.3, just for creation instead
 * of recovery.
 *
 * Usage:
 *   npx tsx scripts/create-user.ts "Your Name" you@example.com "a real password"
 */
import { argon2id, hash } from "argon2";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { assertPasswordAllowed } from "../src/lib/auth/pwned-password";

const defaultDatabaseUrl = "postgres://fleetos:fleetos@localhost:5433/fleetos";

/**
 * Duplicated from `src/lib/auth/password.ts`'s `ARGON2_OPTIONS`, not
 * imported from it — that file has `import "server-only"` at the top,
 * which unconditionally throws outside Next.js's own bundler (confirmed:
 * plain `tsx`/Node hits the throwing base module, not the harmless one
 * Next swaps in via webpack). Keep these parameters in sync by hand if
 * `SECURITY_PLAN.md` §2.1's profile ever changes.
 */
const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function main() {
  const [name, email, plainPassword] = process.argv.slice(2);

  if (!name || !email || !plainPassword) {
    console.error('Usage: npx tsx scripts/create-user.ts "Your Name" you@example.com "a real password"');
    process.exit(1);
  }

  // Length + HIBP k-anonymity check (SECURITY_PLAN.md §2.2). There is no
  // in-app password-set UI yet beyond this script and reset-password.ts.
  await assertPasswordAllowed(plainPassword);

  const connectionString = process.env.DATABASE_URL?.trim() || defaultDatabaseUrl;
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    const passwordHash = await hash(plainPassword, ARGON2_OPTIONS);
    const inserted = await db
      .insert(schema.users)
      .values({ name, email, passwordHash })
      .returning({ id: schema.users.id, email: schema.users.email });

    console.log("User created:", inserted[0]);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("create-user failed:", error);
  process.exit(1);
});
