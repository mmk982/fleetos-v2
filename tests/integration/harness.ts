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
  // Phase 2
  certEventA: string;
  certEventB: string;
  certAttachA: string;
  certAttachB: string;
  deficiencyA: string;
  deficiencyB: string;
  deficiencyAttachA: string;
  deficiencyAttachB: string;
  insuranceA: string;
  insuranceB: string;
  insuranceAttachA: string;
  insuranceAttachB: string;
  manualA: string;
  manualB: string;
  manualRevisionA: string;
  manualRevisionB: string;
  drawingA: string;
  drawingB: string;
  drawingAttachA: string;
  drawingAttachB: string;
  monthlyReqA: string;
  monthlyReqB: string;
  monthlyFormA: string;
  monthlyFormB: string;
  monthlyAttachA: string;
  monthlyAttachB: string;
  particularsA: string;
  particularsB: string;
  particularsAttachA: string;
  particularsAttachB: string;
  noteA: string;
  noteB: string;
  reminderA: string;
  reminderB: string;
  reminderFleet: string;
  auditA: string;
  auditB: string;
  pscA: string;
  pscB: string;
  notifA: string;
  notifB: string;
  ismTemplateId: string;
  deficiencySourceId: string;
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

  // --- Phase 2 fixtures ---
  const certEventA = randomUUID();
  const certEventB = randomUUID();
  await db.insert(schema.certificateEvents).values([
    {
      id: certEventA,
      certificateId: certA,
      eventType: "issued",
      eventDate: "2024-01-01",
    },
    {
      id: certEventB,
      certificateId: certB,
      eventType: "issued",
      eventDate: "2024-01-01",
    },
  ]);

  const certAttachA = randomUUID();
  const certAttachB = randomUUID();
  await db.insert(schema.certificateAttachments).values([
    {
      id: certAttachA,
      certificateId: certA,
      fileName: "cert-a.pdf",
      filePath: "cert-a.pdf",
    },
    {
      id: certAttachB,
      certificateId: certB,
      fileName: "cert-b.pdf",
      filePath: "cert-b.pdf",
    },
  ]);

  const [sourceRow] = await db
    .select({ id: schema.deficiencySources.id })
    .from(schema.deficiencySources)
    .limit(1);
  const deficiencySourceId = sourceRow!.id;

  const deficiencyA = randomUUID();
  const deficiencyB = randomUUID();
  await db.insert(schema.deficiencies).values([
    {
      id: deficiencyA,
      vesselId: vesselA,
      title: "Def A",
      sourceId: deficiencySourceId,
      status: "open",
    },
    {
      id: deficiencyB,
      vesselId: vesselB,
      title: "Def B",
      sourceId: deficiencySourceId,
      status: "open",
    },
  ]);

  const deficiencyAttachA = randomUUID();
  const deficiencyAttachB = randomUUID();
  await db.insert(schema.deficiencyAttachments).values([
    {
      id: deficiencyAttachA,
      deficiencyId: deficiencyA,
      fileName: "def-a.pdf",
      filePath: "def-a.pdf",
    },
    {
      id: deficiencyAttachB,
      deficiencyId: deficiencyB,
      fileName: "def-b.pdf",
      filePath: "def-b.pdf",
    },
  ]);

  const insuranceA = randomUUID();
  const insuranceB = randomUUID();
  await db.insert(schema.insurancePolicies).values([
    {
      id: insuranceA,
      vesselId: vesselA,
      policyType: "hm",
      expiryDate: "2030-01-01",
    },
    {
      id: insuranceB,
      vesselId: vesselB,
      policyType: "hm",
      expiryDate: "2030-01-01",
    },
  ]);

  const insuranceAttachA = randomUUID();
  const insuranceAttachB = randomUUID();
  await db.insert(schema.insuranceAttachments).values([
    {
      id: insuranceAttachA,
      insurancePolicyId: insuranceA,
      fileName: "ins-a.pdf",
      filePath: "ins-a.pdf",
    },
    {
      id: insuranceAttachB,
      insurancePolicyId: insuranceB,
      fileName: "ins-b.pdf",
      filePath: "ins-b.pdf",
    },
  ]);

  const [ismCat] = await db
    .insert(schema.ismTemplateCategories)
    .values({ id: randomUUID(), name: "RLS Cat", isCustom: true })
    .returning({ id: schema.ismTemplateCategories.id });

  const [ismTemplate] = await db
    .insert(schema.ismTemplates)
    .values({
      id: randomUUID(),
      formCode: "RLS-T1",
      formName: "RLS Template",
      categoryId: ismCat.id,
      status: "active",
    })
    .returning({ id: schema.ismTemplates.id });
  const ismTemplateId = ismTemplate.id;

  const manualA = randomUUID();
  const manualB = randomUUID();
  await db.insert(schema.manuals).values([
    { id: manualA, vesselId: vesselA, title: "Manual A" },
    { id: manualB, vesselId: vesselB, title: "Manual B" },
  ]);

  const manualRevisionA = randomUUID();
  const manualRevisionB = randomUUID();
  await db.insert(schema.manualRevisions).values([
    {
      id: manualRevisionA,
      manualId: manualA,
      fileName: "man-a.pdf",
      filePath: "man-a.pdf",
      isCurrentVersion: true,
    },
    {
      id: manualRevisionB,
      manualId: manualB,
      fileName: "man-b.pdf",
      filePath: "man-b.pdf",
      isCurrentVersion: true,
    },
  ]);

  const [drawingCat] = await db
    .insert(schema.drawingCategories)
    .values({ id: randomUUID(), name: "RLS Drawing Cat", isCustom: true })
    .returning({ id: schema.drawingCategories.id });

  const drawingA = randomUUID();
  const drawingB = randomUUID();
  await db.insert(schema.drawings).values([
    {
      id: drawingA,
      vesselId: vesselA,
      categoryId: drawingCat.id,
      drawingName: "Drawing A",
    },
    {
      id: drawingB,
      vesselId: vesselB,
      categoryId: drawingCat.id,
      drawingName: "Drawing B",
    },
  ]);

  const drawingAttachA = randomUUID();
  const drawingAttachB = randomUUID();
  await db.insert(schema.drawingAttachments).values([
    {
      id: drawingAttachA,
      drawingId: drawingA,
      fileName: "drw-a.pdf",
      filePath: "drw-a.pdf",
    },
    {
      id: drawingAttachB,
      drawingId: drawingB,
      fileName: "drw-b.pdf",
      filePath: "drw-b.pdf",
    },
  ]);

  const monthlyReqA = randomUUID();
  const monthlyReqB = randomUUID();
  await db.insert(schema.monthlyFormRequirements).values([
    {
      id: monthlyReqA,
      vesselId: vesselA,
      ismTemplateId,
      frequency: "monthly",
    },
    {
      id: monthlyReqB,
      vesselId: vesselB,
      ismTemplateId,
      frequency: "monthly",
    },
  ]);

  const monthlyFormA = randomUUID();
  const monthlyFormB = randomUUID();
  await db.insert(schema.monthlyExecutedForms).values([
    {
      id: monthlyFormA,
      vesselId: vesselA,
      ismTemplateId,
      formName: "Form A",
      month: 1,
      year: 2030,
      status: "pending",
    },
    {
      id: monthlyFormB,
      vesselId: vesselB,
      ismTemplateId,
      formName: "Form B",
      month: 1,
      year: 2030,
      status: "pending",
    },
  ]);

  const monthlyAttachA = randomUUID();
  const monthlyAttachB = randomUUID();
  await db.insert(schema.monthlyExecutedFormAttachments).values([
    {
      id: monthlyAttachA,
      executedFormId: monthlyFormA,
      fileName: "mf-a.pdf",
      filePath: "mf-a.pdf",
    },
    {
      id: monthlyAttachB,
      executedFormId: monthlyFormB,
      fileName: "mf-b.pdf",
      filePath: "mf-b.pdf",
    },
  ]);

  const particularsA = randomUUID();
  const particularsB = randomUUID();
  await db.insert(schema.vesselParticulars).values([
    { id: particularsA, vesselId: vesselA, isCurrent: true },
    { id: particularsB, vesselId: vesselB, isCurrent: true },
  ]);

  const particularsAttachA = randomUUID();
  const particularsAttachB = randomUUID();
  await db.insert(schema.vesselParticularsAttachments).values([
    {
      id: particularsAttachA,
      particularsId: particularsA,
      fileName: "vp-a.pdf",
      filePath: "vp-a.pdf",
    },
    {
      id: particularsAttachB,
      particularsId: particularsB,
      fileName: "vp-b.pdf",
      filePath: "vp-b.pdf",
    },
  ]);

  const noteA = randomUUID();
  const noteB = randomUUID();
  await db.insert(schema.vesselNotes).values([
    { id: noteA, vesselId: vesselA, body: "Note A", authorId: users.admin },
    { id: noteB, vesselId: vesselB, body: "Note B", authorId: users.admin },
  ]);

  const reminderA = randomUUID();
  const reminderB = randomUUID();
  const reminderFleet = randomUUID();
  await db.insert(schema.reminders).values([
    {
      id: reminderA,
      vesselId: vesselA,
      title: "Rem A",
      type: "custom",
      reminderDate: "2030-06-01",
      status: "pending",
    },
    {
      id: reminderB,
      vesselId: vesselB,
      title: "Rem B",
      type: "custom",
      reminderDate: "2030-06-01",
      status: "pending",
    },
    {
      id: reminderFleet,
      vesselId: null,
      title: "Fleet Rem",
      type: "custom",
      reminderDate: "2030-06-01",
      status: "pending",
    },
  ]);

  const auditA = randomUUID();
  const auditB = randomUUID();
  await db.insert(schema.audits).values([
    {
      id: auditA,
      vesselId: vesselA,
      auditType: "ISSC",
      auditDate: "2024-01-01",
    },
    {
      id: auditB,
      vesselId: vesselB,
      auditType: "ISSC",
      auditDate: "2024-01-01",
    },
  ]);

  const pscA = randomUUID();
  const pscB = randomUUID();
  await db.insert(schema.pscInspections).values([
    {
      id: pscA,
      vesselId: vesselA,
      port: "Port A",
      inspectionDate: "2024-01-01",
      authority: "PSC",
      result: "no_deficiencies",
    },
    {
      id: pscB,
      vesselId: vesselB,
      port: "Port B",
      inspectionDate: "2024-01-01",
      authority: "PSC",
      result: "no_deficiencies",
    },
  ]);

  const notifA = randomUUID();
  const notifB = randomUUID();
  await db.insert(schema.notifications).values([
    {
      id: notifA,
      userId: users.vesselUserA,
      vesselId: vesselA,
      recordId: certA,
      title: "Notif A",
      notificationType: "certificate_due",
      cycleKey: "2030-01-01",
    },
    {
      id: notifB,
      userId: users.vesselUserB,
      vesselId: vesselB,
      recordId: certB,
      title: "Notif B",
      notificationType: "certificate_due",
      cycleKey: "2030-01-01",
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
    certEventA,
    certEventB,
    certAttachA,
    certAttachB,
    deficiencyA,
    deficiencyB,
    deficiencyAttachA,
    deficiencyAttachB,
    insuranceA,
    insuranceB,
    insuranceAttachA,
    insuranceAttachB,
    manualA,
    manualB,
    manualRevisionA,
    manualRevisionB,
    drawingA,
    drawingB,
    drawingAttachA,
    drawingAttachB,
    monthlyReqA,
    monthlyReqB,
    monthlyFormA,
    monthlyFormB,
    monthlyAttachA,
    monthlyAttachB,
    particularsA,
    particularsB,
    particularsAttachA,
    particularsAttachB,
    noteA,
    noteB,
    reminderA,
    reminderB,
    reminderFleet,
    auditA,
    auditB,
    pscA,
    pscB,
    notifA,
    notifB,
    ismTemplateId,
    deficiencySourceId,
  };
}

export { appUrl, ownerAdminUrl };
