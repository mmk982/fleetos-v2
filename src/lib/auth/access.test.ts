/**
 * Controller-layer access gates. `requireScopedVesselId` is security-critical:
 * it must fail closed for vessel-scoped roles with no vessel, never fall
 * through to an unfiltered query.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  assertAuthenticatedAccess,
  assertVesselScope,
  ForbiddenError,
  requireScopedVesselId,
  type AccessContext,
} from "./access";

const VESSEL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_VESSEL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function ctx(overrides: Partial<AccessContext>): AccessContext {
  return { userId: "user-1", role: "admin", vesselId: null, ...overrides };
}

describe("requireScopedVesselId", () => {
  it("throws ForbiddenError for vessel_user with null vesselId (fail closed)", () => {
    expect(() =>
      requireScopedVesselId(ctx({ role: "vessel_user", vesselId: null })),
    ).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError for management_user with null vesselId (fail closed)", () => {
    expect(() =>
      requireScopedVesselId(ctx({ role: "management_user", vesselId: null })),
    ).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError for a vessel-scoped role with an empty-string vesselId", () => {
    expect(() =>
      requireScopedVesselId(ctx({ role: "vessel_user", vesselId: "" })),
    ).toThrow(ForbiddenError);
  });

  it("returns the assigned vessel id for vessel_user", () => {
    expect(
      requireScopedVesselId(ctx({ role: "vessel_user", vesselId: VESSEL_ID })),
    ).toBe(VESSEL_ID);
  });

  it("returns the assigned vessel id for management_user", () => {
    expect(
      requireScopedVesselId(
        ctx({ role: "management_user", vesselId: VESSEL_ID }),
      ),
    ).toBe(VESSEL_ID);
  });

  it("returns undefined for admin with null vesselId (office role, no throw)", () => {
    expect(requireScopedVesselId(ctx({ role: "admin", vesselId: null }))).toBe(
      undefined,
    );
  });

  it("returns undefined for superintendent with null vesselId", () => {
    expect(
      requireScopedVesselId(ctx({ role: "superintendent", vesselId: null })),
    ).toBe(undefined);
  });

  it("returns undefined for read_only with null vesselId", () => {
    expect(
      requireScopedVesselId(ctx({ role: "read_only", vesselId: null })),
    ).toBe(undefined);
  });

  it("returns undefined for a legacy null role", () => {
    expect(requireScopedVesselId(ctx({ role: null, vesselId: null }))).toBe(
      undefined,
    );
  });

  it("requires an authenticated context before evaluating scope", () => {
    expect(() =>
      requireScopedVesselId(
        ctx({ userId: "", role: "vessel_user", vesselId: VESSEL_ID }),
      ),
    ).toThrow(ForbiddenError);
  });
});

describe("assertVesselScope", () => {
  it("is a no-op for office roles", () => {
    expect(() =>
      assertVesselScope(ctx({ role: "admin" }), OTHER_VESSEL_ID),
    ).not.toThrow();
  });

  it("throws on vessel mismatch for a vessel-scoped role", () => {
    expect(() =>
      assertVesselScope(
        ctx({ role: "vessel_user", vesselId: VESSEL_ID }),
        OTHER_VESSEL_ID,
      ),
    ).toThrow(ForbiddenError);
  });

  it("passes when the vessel matches", () => {
    expect(() =>
      assertVesselScope(
        ctx({ role: "vessel_user", vesselId: VESSEL_ID }),
        VESSEL_ID,
      ),
    ).not.toThrow();
  });
});

describe("assertAuthenticatedAccess", () => {
  it("throws when userId is blank", () => {
    expect(() => assertAuthenticatedAccess(ctx({ userId: "  " }))).toThrow(
      ForbiddenError,
    );
  });
});
