/**
 * E-04: DELETE /api/ism-templates/[id] maps Conflict → 409.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rejectCrossOrigin = vi.fn(async () => null);
vi.mock("@/lib/auth/request-guard", () => ({
  rejectCrossOrigin: () => rejectCrossOrigin(),
}));

const validateSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  validateSession: () => validateSession(),
}));

vi.mock("@/lib/auth/access", () => ({
  ForbiddenError: class ForbiddenError extends Error {
    readonly code = "FORBIDDEN" as const;
    constructor(message = "Forbidden") {
      super(message);
      this.name = "ForbiddenError";
    }
  },
  toAccessContext: (session: { user: { id: string } }) => ({
    userId: session.user.id,
    role: "admin",
    vesselId: null,
  }),
}));

const deleteIsmTemplate = vi.fn();
vi.mock("@/modules/ism-templates/ismTemplate.controller", () => {
  class IsmTemplateConflictError extends Error {
    readonly code = "ISM_TEMPLATE_CONFLICT" as const;
    constructor(message: string) {
      super(message);
      this.name = "IsmTemplateConflictError";
    }
  }
  class IsmTemplateNotFoundError extends Error {
    readonly code = "ISM_TEMPLATE_NOT_FOUND" as const;
    constructor(id: string) {
      super(`ISM template not found: ${id}`);
      this.name = "IsmTemplateNotFoundError";
    }
  }
  return {
    deleteIsmTemplate: (...args: unknown[]) => deleteIsmTemplate(...args),
    getIsmTemplateById: vi.fn(),
    updateIsmTemplate: vi.fn(),
    IsmTemplateConflictError,
    IsmTemplateNotFoundError,
  };
});

import { IsmTemplateConflictError } from "@/modules/ism-templates/ismTemplate.controller";
import { DELETE } from "./route";

const TEMPLATE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("DELETE /api/ism-templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rejectCrossOrigin.mockResolvedValue(null);
    validateSession.mockResolvedValue({
      user: { id: "user-1" },
    });
  });

  it("returns 409 when deleteIsmTemplate throws Conflict", async () => {
    deleteIsmTemplate.mockRejectedValue(
      new IsmTemplateConflictError(
        "Cannot delete: this ISM template is still referenced by monthly form requirements or other records.",
      ),
    );

    const res = await DELETE(new Request("http://localhost/api/ism-templates/x", {
      method: "DELETE",
    }), {
      params: Promise.resolve({ id: TEMPLATE_ID }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/still referenced/i);
  });
});
