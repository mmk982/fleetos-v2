/**
 * Creates an isolated `fleetos_rls_test` database, migrates it, grants
 * `fleetos_app`, and seeds phase-1 fixtures. Drops the DB on teardown.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { ensureAppRoleGrants } from "../../scripts/ensure-app-role";
import { defaultOwnerUrl } from "@/db/urls";

export const RLS_TEST_DB = "fleetos_rls_test";

export type RlsFixtures = {
  vesselA: string;
  vesselB: string;
  users: {
    admin: string;
    superintendent: string;
    readOnly: string;
    managementA: string;
    vesselUserA: string;
    vesselUserB: string;
  };
  certA: string;
  certB: string;
  crewA: string;
  crewB: string;
  crewCertA: string;
  crewCertB: string;
  crewAttachA: string;
  crewAttachB: string;
  accessLogA: string;
  accessLogB: string;
  certificateTypeId: string;
};

function ownerAdminUrl(database: string): string {
  const base = process.env.DATABASE_MIGRATE_URL?.trim() || defaultOwnerUrl;
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

function appUrl(database: string): string {
  const url = new URL(ownerAdminUrl(database));
  url.username = "fleetos_app";
  url.password = "fleetos_app";
  return url.toString();
}

export function resolveOwnerUrl(): string {
  return process.env.DATABASE_MIGRATE_URL?.trim() || defaultOwnerUrl;
}

/** Returns null when Postgres is unreachable. */
export async function canReachPostgres(): Promise<boolean> {
  const pool = new Pool({
    connectionString: resolveOwnerUrl(),
    connectionTimeoutMillis: 3000,
  });
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

export async function createRlsTestDatabase(): Promise<{
  ownerUrl: string;
  appUrl: string;
  fixtures: RlsFixtures;
}> {
  const maintenanceUrl = resolveOwnerUrl();
  const admin = new Pool({ connectionString: maintenanceUrl });
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [RLS_TEST_DB],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${RLS_TEST_DB}`);
    await admin.query(`CREATE DATABASE ${RLS_TEST_DB}`);
  } finally {
    await admin.end();
  }

  const ownerUrl = ownerAdminUrl(RLS_TEST_DB);
  const runtimeUrl = appUrl(RLS_TEST_DB);

  await ensureAppRoleGrants(ownerUrl);

  const ownerPool = new Pool({ connectionString: ownerUrl });
  const db = drizzle(ownerPool, { schema });
  try {
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    await ensureAppRoleGrants(ownerUrl);
    const fixtures = await seedFixtures(db);
    return { ownerUrl, appUrl: runtimeUrl, fixtures };
  } finally {
    await ownerPool.end();
  }
}

export async function dropRlsTestDatabase(): Promise<void> {
  const admin = new Pool({ connectionString: resolveOwnerUrl() });
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [RLS_TEST_DB],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${RLS_TEST_DB}`);
  } finally {
    await admin.end();
  }
}

async function seedFixtures(
  db: ReturnType<typeof drizzle<typeof schema>>,
): Promise<RlsFixtures> {
  const vesselA = randomUUID();
  const vesselB = randomUUID();
  const passwordHash = "test-hash-not-used-for-login";

  await db.insert(schema.vessels).values([
    {
      id: vesselA,
      name: "Vessel A",
      imoNumber: 9111111,
      status: "active",
    },
    {
      id: vesselB,
      name: "Vessel B",
      imoNumber: 9222222,
      status: "active",
    },
  ]);

  const users = {
    admin: randomUUID(),
    superintendent: randomUUID(),
    readOnly: randomUUID(),
    managementA: randomUUID(),
    vesselUserA: randomUUID(),
    vesselUserB: randomUUID(),
  };

  await db.insert(schema.users).values([
    {
      id: users.admin,
      name: "Admin",
      email: "admin-rls@test.local",
      passwordHash,
      role: "admin",
      vesselId: null,
    },
    {
      id: users.superintendent,
      name: "Super",
      email: "super-rls@test.local",
      passwordHash,
      role: "superintendent",
      vesselId: null,
    },
    {
      id: users.readOnly,
      name: "ReadOnly",
      email: "ro-rls@test.local",
      passwordHash,
      role: "read_only",
      vesselId: null,
    },
    {
      id: users.managementA,
      name: "Mgmt A",
      email: "mgmt-a-rls@test.local",
      passwordHash,
      role: "management_user",
      vesselId: vesselA,
    },
    {
      id: users.vesselUserA,
      name: "VU A",
      email: "vu-a-rls@test.local",
      passwordHash,
      role: "vessel_user",
      vesselId: vesselA,
    },
    {
      id: users.vesselUserB,
      name: "VU B",
      email: "vu-b-rls@test.local",
      passwordHash,
      role: "vessel_user",
      vesselId: vesselB,
    },
  ]);

  const [typeRow] = await db
    .insert(schema.certificateTypes)
    .values({
      id: randomUUID(),
      authority: "class",
      name: "RLS Test Type",
      ruleKind: "expiry_offset",
      offsetDays: 30,
      isCustom: true,
    })
    .returning({ id: schema.certificateTypes.id });

  const certA = randomUUID();
  const certB = randomUUID();
  await db.insert(schema.certificates).values([
    {
      id: certA,
      vesselId: vesselA,
      certificateTypeId: typeRow.id,
      lifecycleStatus: "active",
      expiryDate: "2030-01-01",
    },
    {
      id: certB,
      vesselId: vesselB,
      certificateTypeId: typeRow.id,
      lifecycleStatus: "active",
      expiryDate: "2030-01-01",
    },
  ]);

  const crewA = randomUUID();
  const crewB = randomUUID();
  await db.insert(schema.crewMembers).values([
    {
      id: crewA,
      firstName: "Alice",
      lastName: "A",
      vesselId: vesselA,
      status: "active",
    },
    {
      id: crewB,
      firstName: "Bob",
      lastName: "B",
      vesselId: vesselB,
      status: "active",
    },
  ]);

  const crewCertA = randomUUID();
  const crewCertB = randomUUID();
  await db.insert(schema.crewCertificates).values([
    {
      id: crewCertA,
      crewMemberId: crewA,
      name: "Passport A",
      expiryDate: "2030-01-01",
    },
    {
      id: crewCertB,
      crewMemberId: crewB,
      name: "Passport B",
      expiryDate: "2030-01-01",
    },
  ]);

  const crewAttachA = randomUUID();
  const crewAttachB = randomUUID();
  await db.insert(schema.crewCertificateAttachments).values([
    {
      id: crewAttachA,
      crewCertificateId: crewCertA,
      fileName: "a.pdf",
      filePath: "a.pdf",
    },
    {
      id: crewAttachB,
      crewCertificateId: crewCertB,
      fileName: "b.pdf",
      filePath: "b.pdf",
    },
  ]);

  const accessLogA = randomUUID();
  const accessLogB = randomUUID();
  await db.insert(schema.accessLogs).values([
    {
      id: accessLogA,
      userId: users.vesselUserA,
      moduleName: "crew",
      recordId: crewA,
      accessType: "view",
    },
    {
      id: accessLogB,
      userId: users.vesselUserB,
      moduleName: "crew",
      recordId: crewB,
      accessType: "view",
    },
  ]);

  return {
    vesselA,
    vesselB,
    users,
    certA,
    certB,
    crewA,
    crewB,
    crewCertA,
    crewCertB,
    crewAttachA,
    crewAttachB,
    accessLogA,
    accessLogB,
    certificateTypeId: typeRow.id,
  };
}

export { appUrl, ownerAdminUrl };
