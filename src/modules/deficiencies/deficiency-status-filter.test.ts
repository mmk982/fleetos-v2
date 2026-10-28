import { describe, expect, it } from "vitest";
import {
  ACTIVE_DEFICIENCY_STATUSES,
  parseDeficiencyStatusFilter,
} from "./deficiency.model";

describe("parseDeficiencyStatusFilter", () => {
  it("accepts every real status and the 'active' pseudo-status", () => {
    for (const s of ["open", "in_progress", "closed", "monitoring"]) {
      expect(parseDeficiencyStatusFilter(s)).toBe(s);
    }
    expect(parseDeficiencyStatusFilter("active")).toBe("active");
  });

  it("drops unknown or missing values", () => {
    expect(parseDeficiencyStatusFilter("bogus")).toBeUndefined();
    expect(parseDeficiencyStatusFilter("")).toBeUndefined();
    expect(parseDeficiencyStatusFilter(undefined)).toBeUndefined();
    expect(parseDeficiencyStatusFilter(null)).toBeUndefined();
  });

  it("'active' means everything except closed", () => {
    expect([...ACTIVE_DEFICIENCY_STATUSES].sort()).toEqual(
      ["in_progress", "monitoring", "open"],
    );
  });
});
