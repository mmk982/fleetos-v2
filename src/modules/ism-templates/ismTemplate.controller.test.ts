/**
 * ISM template controller CRUD (mocked DB) — no cachedStatus / expiry.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: vi.fn(),
}));

vi.mock("@/lib/attachments/stream", () => ({
  removeStoredAttachmentFile: vi.fn(async () => undefined),
}));

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
}));

const getDb = vi.fn();
vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

import {
  createIsmTemplate,
  deleteIsmTemplate,
  getIsmTemplateById,
  listIsmTemplates,
  updateIsmTemplate,
} from "./ismTemplate.controller";

const CATEGORY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CTX = { userId: "user-1", role: null, vesselId: null };

function thenable<T>(value: T) {
  return {
    limit: async () => value,
    orderBy: async () => value,
    then: (
      onfulfilled?: (v: T) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) => Promise.resolve(value).then(onfulfilled, onrejected),
  };
}

describe("ismTemplate.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listIsmTemplates joins categoryName and orders by formCode", async () => {
    const template = {
      id: TEMPLATE_ID,
      formCode: "DRILL-01",
      formName: "Fire drill",
      categoryId: CATEGORY_ID,
      revision: "A",
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: async () => [
                { template, categoryName: "Drill" },
              ],
            }),
            orderBy: async () => [{ template, categoryName: "Drill" }],
          }),
        }),
      }),
    });

    const rows = await listIsmTemplates(CTX);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.categoryName).toBe("Drill");
    expect(rows[0]?.formCode).toBe("DRILL-01");
    expect(rows[0]).not.toHaveProperty("compliance");
  });

  it("createIsmTemplate inserts without cachedStatus", async () => {
    const inserted = {
      id: TEMPLATE_ID,
      formCode: "SAFE-01",
      formName: "Safety checklist",
      categoryId: CATEGORY_ID,
      revision: null,
      status: "active" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getDb.mockReturnValue({
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          expect(vals).not.toHaveProperty("cachedStatus");
          expect(vals).not.toHaveProperty("vesselId");
          return { returning: async () => [inserted] };
        },
      }),
    });

    const row = await createIsmTemplate(CTX, {
      formCode: "SAFE-01",
      formName: "Safety checklist",
      categoryId: CATEGORY_ID,
      status: "active",
    });
    expect(row.id).toBe(TEMPLATE_ID);
  });

  it("updateIsmTemplate patches fields and returns the row", async () => {
    const updated = {
      id: TEMPLATE_ID,
      formCode: "SAFE-01",
      formName: "Safety checklist v2",
      categoryId: CATEGORY_ID,
      revision: "B",
      status: "draft" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => thenable([{ id: TEMPLATE_ID }]),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => [updated],
          }),
        }),
      }),
    });

    const row = await updateIsmTemplate(CTX, TEMPLATE_ID, {
      formName: "Safety checklist v2",
      status: "draft",
    });
    expect(row.formName).toBe("Safety checklist v2");
    expect(row.status).toBe("draft");
  });

  it("getIsmTemplateById returns undefined when missing", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => thenable([]),
          }),
        }),
      }),
    });

    await expect(getIsmTemplateById(CTX, TEMPLATE_ID)).resolves.toBeUndefined();
  });

  it("deleteIsmTemplate removes attachment files then the row", async () => {
    const { removeStoredAttachmentFile } = await import(
      "@/lib/attachments/stream"
    );

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () =>
            thenable([
              {
                id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                ismTemplateId: TEMPLATE_ID,
                fileName: "blank.pdf",
                filePath: "data/attachments/blank.pdf",
                uploadedBy: null,
                uploadedAt: new Date(),
              },
            ]),
        }),
      }),
      delete: () => ({
        where: () => ({
          returning: async () => [{ id: TEMPLATE_ID }],
        }),
      }),
    });

    await deleteIsmTemplate(CTX, TEMPLATE_ID);
    expect(removeStoredAttachmentFile).toHaveBeenCalledWith(
      "data/attachments/blank.pdf",
    );
  });
});
