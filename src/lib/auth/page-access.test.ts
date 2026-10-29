import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ForbiddenError,
  MissingVesselAssignmentError,
  type AccessContext,
} from "@/lib/auth/access";
import {
  classifyPageAccessError,
  planMonthlyFormsPageData,
  planVesselRegistryPageAccess,
} from "@/lib/auth/page-access";

function ctx(
  partial: Partial<AccessContext> & Pick<AccessContext, "role">,
): AccessContext {
  return {
    userId: partial.userId ?? "u1",
    role: partial.role,
    vesselId: partial.vesselId ?? null,
  };
}

describe("classifyPageAccessError", () => {
  it("maps MissingVesselAssignmentError to missing-vessel", () => {
    expect(
      classifyPageAccessError(
        new MissingVesselAssignmentError(),
        ctx({ role: "vessel_user", vesselId: null }),
      ),
    ).toBe("missing-vessel");
  });

  it("maps other ForbiddenError to forbidden", () => {
    expect(
      classifyPageAccessError(
        new ForbiddenError('Insufficient access for module "vessels" (need read).'),
        ctx({ role: "vessel_user", vesselId: "v1" }),
      ),
    ).toBe("forbidden");
  });

  it("does not treat a plain ForbiddenError as missing-vessel for vuNone", () => {
    // Must use the dedicated class — do not classify by message / role alone.
    expect(
      classifyPageAccessError(
        new ForbiddenError("Vessel-scoped role has no assigned vessel — access denied."),
        ctx({ role: "vessel_user", vesselId: null }),
      ),
    ).toBe("forbidden");
  });

  it("returns null for unrelated errors", () => {
    expect(
      classifyPageAccessError(new Error("boom"), ctx({ role: "admin" })),
    ).toBeNull();
  });
});

describe("planMonthlyFormsPageData", () => {
  it("loads requirements only for full access", () => {
    expect(planMonthlyFormsPageData("admin")).toEqual({
      loadRequirements: true,
      canManageRequirements: true,
      canCreateAdHoc: true,
      canGenerateChecklist: true,
    });
    expect(planMonthlyFormsPageData("superintendent")).toEqual({
      loadRequirements: true,
      canManageRequirements: true,
      canCreateAdHoc: true,
      canGenerateChecklist: true,
    });
  });

  it("does not load requirements for submit roles", () => {
    expect(planMonthlyFormsPageData("vessel_user")).toEqual({
      loadRequirements: false,
      canManageRequirements: false,
      canCreateAdHoc: false,
      canGenerateChecklist: false,
    });
    expect(planMonthlyFormsPageData("management_user")).toEqual({
      loadRequirements: false,
      canManageRequirements: false,
      canCreateAdHoc: false,
      canGenerateChecklist: false,
    });
  });

  it("does not load requirements for read_only / null", () => {
    expect(planMonthlyFormsPageData("read_only").loadRequirements).toBe(false);
    expect(planMonthlyFormsPageData(null).loadRequirements).toBe(false);
  });
});

describe("planVesselRegistryPageAccess", () => {
  it("allows only admin (vessels write/read in matrix)", () => {
    expect(planVesselRegistryPageAccess("admin")).toBe("allow");
    expect(planVesselRegistryPageAccess("superintendent")).toBe("deny");
    expect(planVesselRegistryPageAccess("management_user")).toBe("deny");
    expect(planVesselRegistryPageAccess("vessel_user")).toBe("deny");
    expect(planVesselRegistryPageAccess("read_only")).toBe("deny");
    expect(planVesselRegistryPageAccess(null)).toBe("deny");
  });
});
