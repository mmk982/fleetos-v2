/**
 * A-16 / A-20: GET /api/vessels/[id] maps Forbidden → 403; bad UUID → 404.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const validateSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  validateSession: () => validateSession(),
}));

vi.mock("@/lib/auth/access", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/access")>(
    "@/lib/auth/access",
  );
  return {
    ...actual,
    toAccessContext: (session: { user: { id: string } }) => ({
      userId: session.user.id,
      role: "management_user",
      vesselId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
  };
});

const getVesselById = vi.fn();
vi.mock("@/modules/vessels/vessel.controller", () => ({
  getVesselById: (...args: unknown[]) => getVesselById(...args),
  updateVessel: vi.fn(),
  deleteVessel: vi.fn(),
  VesselConflictError: class VesselConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "VesselConflictError";
    }
  },
}));

import { ForbiddenError } from "@/lib/auth/access";
import { GET } from "./route";

const VESSEL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("GET /api/vessels/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateSession.mockResolvedValue({
      user: { id: "user-1" },
    });
  });

  it("returns 403 when getVesselById throws ForbiddenError", async () => {
    getVesselById.mockRejectedValue(new ForbiddenError("Forbidden"));
    const res = await GET(new Request("http://localhost/api/vessels/x"), {
      params: Promise.resolve({ id: VESSEL_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 for a malformed uuid param", async () => {
    const res = await GET(new Request("http://localhost/api/vessels/x"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(res.status).toBe(404);
    expect(getVesselById).not.toHaveBeenCalled();
  });
});
