/**
 * Break-glass admin password reset (`SECURITY_PLAN.md` §2.3).
 *
 * Operational tool only — not an app feature. v1 has no self-service reset;
 * if an Admin (or any) account is locked out, Eng.MHD runs this against
 * Postgres using the same Argon2id profile as production hashing.
 *
 * Argon2id options are duplicated from `src/lib/auth/password.ts` rather
 * than imported — that file has `import "server-only"`, which throws under
 * plain `tsx`/Node (same reason as `scripts/create-user.ts`).
 *
 * Usage:
 *   npx tsx scripts/reset-password.ts you@example.com "a new long password"
 */
import { eq } from "drizzle-orm";
import { argon2id, hash } from "argon2";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { assertPasswordAllowed } from "../src/lib/auth/pwned-password";

const defaultDatabaseUrl = "postgres://fleetos:fleetos@localhost:5433/fleetos";

/**
 * Duplicated from `src/lib/auth/password.ts`'s `ARGON2_OPTIONS` — keep in
 * sync by hand if `SECURITY_PLAN.md` §2.1's profile ever changes.
 */
const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function main() {
  const [email, plainPassword] = process.argv.slice(2);

  if (!email || !plainPassword) {
    console.error('Usage: npx tsx scripts/reset-password.ts you@example.com "a new long password"');
    process.exit(1);
  }

  await assertPasswordAllowed(plainPassword);

  const connectionString = process.env.DATABASE_URL?.trim() || defaultDatabaseUrl;
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    const passwordHash = await hash(plainPassword, ARGON2_OPTIONS);
    const updated = await db
      .update(schema.users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.users.email, email))
      .returning({ id: schema.users.id, email: schema.users.email });

    if (updated.length === 0) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    console.log("Password reset for:", updated[0]);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("reset-password failed:", error);
  process.exit(1);
});
