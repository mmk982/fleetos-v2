/**
 * Monthly executed forms — checklist generation + submit branches (mocked DB).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: vi.fn(),
}));

const removeStoredAttachmentFile = vi.fn(async (_path: string) => undefined);
vi.mock("@/lib/attachments/stream", () => ({
  removeStoredAttachmentFile: (filePath: string) =>
    removeStoredAttachmentFile(filePath),
}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

import {
  generateMonthlyChecklist,
  isRequirementDueInMonth,
  submitMonthlyForm,
} from "./monthlyForm.controller";

const VESSEL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TEMPLATE_MONTHLY = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_QUARTERLY = "22222222-2222-2222-2222-222222222222";
const TEMPLATE_YEARLY = "33333333-3333-3333-3333-333333333333";
const TEMPLATE_ON_DEMAND = "44444444-4444-4444-4444-444444444444";
const FORM_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CTX = { userId: "user-1", role: null, vesselId: null };

const SAMPLE_FILE = {
  name: "form.pdf",
  type: "application/pdf",
  size: 12,
  bytes: Buffer.from("%PDF-sample"),
};

describe("isRequirementDueInMonth", () => {
  it("monthly is always due", () => {
    expect(isRequirementDueInMonth("monthly", 6)).toBe(true);
  });

  it("quarterly only in Jan/Apr/Jul/Oct", () => {
    expect(isRequirementDueInMonth("quarterly", 1)).toBe(true);
    expect(isRequirementDueInMonth("quarterly", 4)).toBe(true);
    expect(isRequirementDueInMonth("quarterly", 7)).toBe(true);
    expect(isRequirementDueInMonth("quarterly", 10)).toBe(true);
    expect(isRequirementDueInMonth("quarterly", 2)).toBe(false);
  });

  it("yearly only in January", () => {
    expect(isRequirementDueInMonth("yearly", 1)).toBe(true);
    expect(isRequirementDueInMonth("yearly", 6)).toBe(false);
  });

  it("on_demand is never auto-generated", () => {
    expect(isRequirementDueInMonth("on_demand", 1)).toBe(false);
  });
});

describe("generateMonthlyChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts only requirements due in the target month", async () => {
    const insertedTemplates: string[] = [];

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: async () => [
              {
                requirement: {
                  vesselId: VESSEL_ID,
                  ismTemplateId: TEMPLATE_MONTHLY,
                  frequency: "monthly",
                  activeStatus: true,
                },
                templateName: "Monthly drill",
              },
              {
                requirement: {
                  vesselId: VESSEL_ID,
                  ismTemplateId: TEMPLATE_QUARTERLY,
                  frequency: "quarterly",
                  activeStatus: true,
                },
                templateName: "Quarterly check",
              },
              {
                requirement: {
                  vesselId: VESSEL_ID,
                  ismTemplateId: TEMPLATE_YEARLY,
                  frequency: "yearly",
                  activeStatus: true,
                },
                templateName: "Yearly audit",
              },
              {
                requirement: {
                  vesselId: VESSEL_ID,
                  ismTemplateId: TEMPLATE_ON_DEMAND,
                  frequency: "on_demand",
                  activeStatus: true,
                },
                templateName: "Ad hoc",
              },
            ],
          }),
        }),
      }),
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          insertedTemplates.push(String(vals.ismTemplateId));
          return {
            onConflictDoNothing: () => ({
              returning: async () => [{ id: crypto.randomUUID() }],
            }),
          };
        },
      }),
    });

    // March — only monthly qualifies
    const march = await generateMonthlyChecklist(CTX, {
      month: 3,
      year: 2026,
    });
    expect(march.created).toBe(1);
    expect(insertedTemplates).toEqual([TEMPLATE_MONTHLY]);

    insertedTemplates.length = 0;
    const jan = await generateMonthlyChecklist(CTX, {
      month: 1,
      year: 2026,
    });
    expect(jan.created).toBe(3);
    expect(insertedTemplates).toEqual([
      TEMPLATE_MONTHLY,
      TEMPLATE_QUARTERLY,
      TEMPLATE_YEARLY,
    ]);
  });

  it("onConflictDoNothing makes generation idempotent", async () => {
    let insertCalls = 0;
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: async () => [
              {
                requirement: {
                  vesselId: VESSEL_ID,
                  ismTemplateId: TEMPLATE_MONTHLY,
                  frequency: "monthly",
                  activeStatus: true,
                },
                templateName: "Monthly drill",
              },
            ],
          }),
        }),
      }),
      insert: () => ({
        values: () => {
          insertCalls += 1;
          return {
            onConflictDoNothing: () => ({
              // Second call simulates conflict → nothing returned
              returning: async () =>
                insertCalls === 1 ? [{ id: FORM_ID }] : [],
            }),
          };
        },
      }),
    });

    const first = await generateMonthlyChecklist(CTX, {
      month: 5,
      year: 2026,
    });
    const second = await generateMonthlyChecklist(CTX, {
      month: 5,
      year: 2026,
    });
    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
  });
});

describe("submitMonthlyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("first submission sets status, uploadedAt, uploadedBy and inserts attachment", async () => {
    const ops: string[] = [];

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: FORM_ID,
                vesselId: VESSEL_ID,
                ismTemplateId: TEMPLATE_MONTHLY,
                formName: "Drill",
                month: 3,
                year: 2026,
                required: true,
                uploadedAt: null,
                uploadedBy: null,
                status: "pending",
                remarks: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle tx mock
      transaction: async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          insert: () => ({
            values: (vals: Record<string, unknown>) => {
              ops.push("insert-attachment");
              expect(vals.executedFormId).toBe(FORM_ID);
              return Promise.resolve();
            },
          }),
          update: () => ({
            set: (patch: Record<string, unknown>) => {
              ops.push("update-form");
              expect(patch.status).toBe("submitted");
              expect(patch.uploadedBy).toBe(CTX.userId);
              expect(patch.uploadedAt).toBeInstanceOf(Date);
              return {
                where: () => ({
                  returning: async () => [
                    {
                      id: FORM_ID,
                      status: "submitted",
                      uploadedBy: CTX.userId,
                      uploadedAt: patch.uploadedAt,
                    },
                  ],
                }),
              };
            },
          }),
        }),
    });

    const row = await submitMonthlyForm(
      CTX,
      FORM_ID,
      { remarks: "done" },
      SAMPLE_FILE,
    );
    expect(ops).toEqual(["insert-attachment", "update-form"]);
    expect(row.status).toBe("submitted");
  });

  it("re-submission only inserts an attachment", async () => {
    const ops: string[] = [];

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: FORM_ID,
                vesselId: VESSEL_ID,
                ismTemplateId: TEMPLATE_MONTHLY,
                formName: "Drill",
                month: 3,
                year: 2026,
                required: true,
                uploadedAt: new Date("2026-03-01"),
                uploadedBy: CTX.userId,
                status: "submitted",
                remarks: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle tx mock
      transaction: async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          insert: () => ({
            values: () => {
              ops.push("insert-attachment");
              return Promise.resolve();
            },
          }),
          update: () => ({
            set: (patch: Record<string, unknown>) => {
              ops.push("touch-updatedAt");
              expect(patch.status).toBeUndefined();
              expect(patch.uploadedAt).toBeUndefined();
              return {
                where: () => ({
                  returning: async () => [
                    {
                      id: FORM_ID,
                      status: "submitted",
                      uploadedBy: CTX.userId,
                    },
                  ],
                }),
              };
            },
          }),
        }),
    });

    const row = await submitMonthlyForm(CTX, FORM_ID, {}, SAMPLE_FILE);
    expect(ops).toEqual(["insert-attachment", "touch-updatedAt"]);
    expect(row.status).toBe("submitted");
  });
});
