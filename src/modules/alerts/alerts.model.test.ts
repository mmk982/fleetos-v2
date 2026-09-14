/**
 * Alerts model contracts + filter helper.
 */
import { describe, expect, it } from "vitest";
import {
  ALERT_KINDS,
  DEFICIENCY_ALERT_REMINDER_RULE,
  parseAlertStatusFilter,
} from "./alerts.model";

describe("alerts.model", () => {
  it("defines four alert kinds", () => {
    expect(ALERT_KINDS).toEqual([
      "certificate",
      "crew_certificate",
      "insurance",
      "deficiency",
    ]);
  });

  it("uses a fixed 30d expiry_offset rule for deficiencies", () => {
    expect(DEFICIENCY_ALERT_REMINDER_RULE).toEqual({
      kind: "expiry_offset",
      offsetDays: 30,
    });
  });

  it("parseAlertStatusFilter defaults to undefined (actionable)", () => {
    expect(parseAlertStatusFilter(undefined)).toBeUndefined();
    expect(parseAlertStatusFilter("")).toBeUndefined();
    expect(parseAlertStatusFilter("bogus")).toBeUndefined();
  });

  it("parseAlertStatusFilter accepts single actionable statuses", () => {
    expect(parseAlertStatusFilter("expired")).toEqual(["expired"]);
    expect(parseAlertStatusFilter("critical")).toEqual(["critical"]);
    expect(parseAlertStatusFilter("expiring")).toEqual(["expiring"]);
  });
});
