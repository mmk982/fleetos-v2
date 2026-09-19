/**
 * Drawings controller — CRUD + attachments (mocked DB).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/access", () => ({
  assertAuthenticatedAccess: vi.fn(),
  assertModuleAccess: vi.fn(),
  assertVesselScope: vi.fn(),
}));

const removeStoredAttachmentFile = vi.fn(async (_path: string) => {
  void _path;
});
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
  createDrawing,
  deleteDrawing,
  getDrawingById,
  listDrawings,
  updateDrawing,
  uploadDrawingAttachment,
} from "./drawing.controller";

const VESSEL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CATEGORY_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const DRAWING_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
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

describe("drawing.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listDrawings joins vesselName and categoryName", async () => {
    const drawing = {
      id: DRAWING_ID,
      vesselId: VESSEL_ID,
      categoryId: CATEGORY_ID,
      drawingName: "GA Plan",
      drawingNumber: "DWG-01",
      revision: "A",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () =>
                thenable([
                  {
                    drawing,
                    vesselName: "MV Test",
                    categoryName: "General Arrangement",
                  },
                ]),
            }),
          }),
        }),
      }),
    });

    const rows = await listDrawings(CTX);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.vesselName).toBe("MV Test");
    expect(rows[0]?.categoryName).toBe("General Arrangement");
    expect(rows[0]?.drawingName).toBe("GA Plan");
  });

  it("getDrawingById includes attachments", async () => {
    const drawing = {
      id: DRAWING_ID,
      vesselId: VESSEL_ID,
      categoryId: CATEGORY_ID,
      drawingName: "Fire plan",
      drawingNumber: null,
      revision: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    drawing,
                    vesselName: "MV Test",
                    categoryName: "Fire Control Plan",
                  },
                ],
              }),
            }),
          }),
          where: () =>
            thenable([
              {
                id: "att-1",
                drawingId: DRAWING_ID,
                fileName: "plan.pdf",
                filePath: "data/attachments/x.pdf",
                uploadedBy: CTX.userId,
                uploadedAt: new Date(),
              },
            ]),
        }),
      }),
    });

    const row = await getDrawingById(CTX, DRAWING_ID);
    expect(row?.attachments).toHaveLength(1);
    expect(row?.attachments[0]?.fileName).toBe("plan.pdf");
  });

  it("createDrawing inserts and returns the row", async () => {
    const created = {
      id: DRAWING_ID,
      vesselId: VESSEL_ID,
      categoryId: CATEGORY_ID,
      drawingName: "Electrical SLD",
      drawingNumber: null,
      revision: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getDb.mockReturnValue({
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          expect(vals).toMatchObject({
            vesselId: VESSEL_ID,
            categoryId: CATEGORY_ID,
            drawingName: "Electrical SLD",
          });
          return {
            returning: async () => [created],
          };
        },
      }),
    });

    const row = await createDrawing(CTX, {
      vesselId: VESSEL_ID,
      categoryId: CATEGORY_ID,
      drawingName: "Electrical SLD",
    });
    expect(row.id).toBe(DRAWING_ID);
  });

  it("updateDrawing patches metadata only", async () => {
    getDb.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: DRAWING_ID }],
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          expect(patch.drawingName).toBe("Updated name");
          expect(patch.updatedAt).toBeInstanceOf(Date);
          return {
            where: () => ({
              returning: async () => [
                {
                  id: DRAWING_ID,
                  vesselId: VESSEL_ID,
                  categoryId: CATEGORY_ID,
                  drawingName: "Updated name",
                  drawingNumber: null,
                  revision: null,
                  notes: null,
                  createdAt: new Date(),
                  updatedAt: patch.updatedAt,
                },
              ],
            }),
          };
        },
      }),
    });

    const row = await updateDrawing(CTX, DRAWING_ID, {
      drawingName: "Updated name",
    });
    expect(row.drawingName).toBe("Updated name");
  });

  it("deleteDrawing removes attachment files then deletes the row", async () => {
    let selectCalls = 0;
    getDb.mockReturnValue({
      select: () => {
        selectCalls += 1;
        if (selectCalls === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: async () => [
                  {
                    drawingName: "GA Plan",
                    vesselId: VESSEL_ID,
                  },
                ],
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: async () => [
              {
                id: "att-1",
                drawingId: DRAWING_ID,
                fileName: "a.pdf",
                filePath: "data/attachments/a.pdf",
                uploadedBy: null,
                uploadedAt: new Date(),
              },
            ],
          }),
        };
      },
      delete: () => ({
        where: () => ({
          returning: async () => [{ id: DRAWING_ID }],
        }),
      }),
    });

    await deleteDrawing(CTX, DRAWING_ID);
    expect(removeStoredAttachmentFile).toHaveBeenCalledWith(
      "data/attachments/a.pdf",
    );
  });

  it("uploadDrawingAttachment rejects disallowed mime types", async () => {
    await expect(
      uploadDrawingAttachment(CTX, DRAWING_ID, {
        name: "x.exe",
        type: "application/octet-stream",
        size: 10,
        bytes: Buffer.from("x"),
      }),
    ).rejects.toThrow("Only PDF, JPEG, and PNG");
    expect(getDb).not.toHaveBeenCalled();
  });
});
