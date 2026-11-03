/**
 * A-16: GET /api/vessels maps ForbiddenError → 403.
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
      role: "vessel_user",
      vesselId: null,
    }),
  };
});

const listVessels = vi.fn();
vi.mock("@/modules/vessels/vessel.controller", () => ({
  listVessels: (...args: unknown[]) => listVessels(...args),
  createVessel: vi.fn(),
  VesselConflictError: class VesselConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "VesselConflictError";
    }
  },
}));

import { ForbiddenError } from "@/lib/auth/access";
import { GET } from "./route";

describe("GET /api/vessels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateSession.mockResolvedValue({
      user: { id: "user-1" },
    });
  });

  it("returns 403 when listVessels throws ForbiddenError", async () => {
    listVessels.mockRejectedValue(
      new ForbiddenError('Insufficient access for module "vessels" (need read).'),
    );

    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Insufficient access/i);
  });

  it("returns 401 when unauthenticated", async () => {
    validateSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
