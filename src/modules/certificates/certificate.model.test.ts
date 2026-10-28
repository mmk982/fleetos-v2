/**
 * Pure helpers on the certificate list model (no DB).
 */
import { describe, expect, it } from "vitest";
import type { ComplianceResult, ComplianceStatus } from "@/lib/expiry";
import {
  worseActionableSubItemCompliance,
  worstSubItemCompliance,
} from "./certificate.model";

function result(
  status: ComplianceStatus,
  daysRemaining: number | null = 0,
): ComplianceResult {
  return { status, daysRemaining, reference: "expiry" };
}

describe("worstSubItemCompliance", () => {
  it("returns null for an empty children list", () => {
    expect(worstSubItemCompliance([])).toBeNull();
  });

  it("returns the expired child among mixed valid/expiring/expired", () => {
    const worst = worstSubItemCompliance([
      { compliance: result("valid", 400) },
      { compliance: result("expiring", 20) },
      { compliance: result("expired", -5) },
    ]);
    expect(worst?.status).toBe("expired");
  });

  it("breaks ties by fewer daysRemaining", () => {
    const worst = worstSubItemCompliance([
      { compliance: result("critical", 7) },
      { compliance: result("critical", 2) },
      { compliance: result("expiring", 15) },
    ]);
    expect(worst).toEqual(result("critical", 2));
  });
});

describe("worseActionableSubItemCompliance", () => {
  it("returns the expired child when the parent is valid", () => {
    const worse = worseActionableSubItemCompliance(result("valid", 400), [
      { compliance: result("expired", -5) },
    ]);
    expect(worse?.status).toBe("expired");
  });

  it("returns null when the child has the same status but fewer days left", () => {
    const worse = worseActionableSubItemCompliance(result("expiring", 25), [
      { compliance: result("expiring", 3) },
    ]);
    expect(worse).toBeNull();
  });

  it("returns null when the worst child is not actionable", () => {
    expect(
      worseActionableSubItemCompliance(result("valid", 400), [
        { compliance: result("valid", 100) },
        { compliance: result("unknown", null) },
      ]),
    ).toBeNull();
  });

  it("returns null when the parent is already worse than every child", () => {
    expect(
      worseActionableSubItemCompliance(result("expired", -2), [
        { compliance: result("expiring", 10) },
      ]),
    ).toBeNull();
  });

  it("returns null when there are no children", () => {
    expect(worseActionableSubItemCompliance(result("valid", 400), [])).toBeNull();
  });
});
