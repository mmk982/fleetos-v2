/**
 * Derivation rules for the Expiry / Reminder Engine (PROJECT_PLAN.md).
 */
import { describe, expect, it } from "vitest";
import {
  compareBySeverity,
  DEFAULT_CRITICAL_DAYS,
  deriveComplianceStatus,
  isActionable,
  STATUS_LABELS,
  STATUS_STYLES,
  type ComplianceResult,
  type ComplianceStatus,
} from "./index";

/** Fixed "today" so day-boundary math is deterministic (UTC noon). */
const NOW = new Date("2026-06-15T12:00:00.000Z");

function expiryOffset(
  expiryDate: string | null,
  extras: {
    offsetDays?: number | null;
    criticalDays?: number;
    lifecycleStatus?: "active" | "revoked" | "superseded";
  } = {},
) {
  return deriveComplianceStatus({
    rule: { kind: "expiry_offset", offsetDays: extras.offsetDays ?? 30 },
    expiryDate,
    criticalDays: extras.criticalDays,
    lifecycleStatus: extras.lifecycleStatus,
    now: NOW,
  });
}

function windowRule(
  windowOpenDate: string | null,
  extras: {
    windowCloseDate?: string | null;
    expiryDate?: string | null;
    criticalDays?: number;
    lifecycleStatus?: "active" | "revoked" | "superseded";
  } = {},
) {
  return deriveComplianceStatus({
    rule: { kind: "window" },
    expiryDate: extras.expiryDate ?? null,
    windowOpenDate,
    windowCloseDate: extras.windowCloseDate,
    criticalDays: extras.criticalDays,
    lifecycleStatus: extras.lifecycleStatus,
    now: NOW,
  });
}

describe("deriveComplianceStatus — lifecycle override", () => {
  it("returns revoked when lifecycleStatus is revoked, ignoring dates", () => {
    expect(
      expiryOffset("2026-12-31", { lifecycleStatus: "revoked" }).status,
    ).toBe("revoked");
  });

  it("returns revoked when lifecycleStatus is superseded", () => {
    expect(
      expiryOffset("2026-12-31", { lifecycleStatus: "superseded" }).status,
    ).toBe("revoked");
  });

  it("treats omitted lifecycleStatus as active (does not revoke)", () => {
    expect(expiryOffset("2026-12-31").status).toBe("valid");
  });

  it("proceeds normally when lifecycleStatus is active", () => {
    expect(
      expiryOffset("2026-12-31", { lifecycleStatus: "active" }).status,
    ).toBe("valid");
  });

  it("lifecycle revoked overrides even kind none", () => {
    expect(
      deriveComplianceStatus({
        rule: { kind: "none" },
        expiryDate: null,
        lifecycleStatus: "revoked",
        now: NOW,
      }).status,
    ).toBe("revoked");
  });
});

describe("deriveComplianceStatus — kind none", () => {
  it("always returns valid regardless of dates", () => {
    const result = deriveComplianceStatus({
      rule: { kind: "none" },
      expiryDate: null,
      now: NOW,
    });
    expect(result).toEqual({
      status: "valid",
      daysRemaining: null,
      reference: "none",
    });
  });

  it("ignores a past expiryDate when kind is none", () => {
    expect(
      deriveComplianceStatus({
        rule: { kind: "none" },
        expiryDate: "2020-01-01",
        now: NOW,
      }).status,
    ).toBe("valid");
  });
});

describe("deriveComplianceStatus — expiry_offset", () => {
  it("returns unknown when expiryDate is null", () => {
    expect(expiryOffset(null)).toEqual({
      status: "unknown",
      daysRemaining: null,
      reference: "expiry",
    });
  });

  it("returns expired when daysRemaining < 0", () => {
    // expiry was yesterday relative to NOW (2026-06-15)
    expect(expiryOffset("2026-06-14")).toMatchObject({
      status: "expired",
      daysRemaining: -1,
      reference: "expiry",
    });
  });

  it("returns critical when daysRemaining <= criticalDays (default 7)", () => {
    expect(expiryOffset("2026-06-15")).toMatchObject({
      status: "critical",
      daysRemaining: 0,
    });
    expect(expiryOffset("2026-06-22")).toMatchObject({
      status: "critical",
      daysRemaining: 7,
    });
  });

  it("returns expiring when criticalDays < daysRemaining <= offsetDays", () => {
    expect(expiryOffset("2026-06-23")).toMatchObject({
      status: "expiring",
      daysRemaining: 8,
    });
    expect(expiryOffset("2026-07-15")).toMatchObject({
      status: "expiring",
      daysRemaining: 30,
    });
  });

  it("returns valid when daysRemaining > offsetDays", () => {
    expect(expiryOffset("2026-07-16")).toMatchObject({
      status: "valid",
      daysRemaining: 31,
    });
  });

  it("uses caller criticalDays instead of DEFAULT_CRITICAL_DAYS", () => {
    // 10 days out; with criticalDays=14 → critical; with default 7 → expiring
    expect(expiryOffset("2026-06-25", { criticalDays: 14 }).status).toBe(
      "critical",
    );
    expect(expiryOffset("2026-06-25").status).toBe("expiring");
  });

  it("honors a 180d offset (renewal / dry-dock style)", () => {
    expect(expiryOffset("2026-12-12", { offsetDays: 180 })).toMatchObject({
      status: "expiring",
      daysRemaining: 180,
    });
    expect(expiryOffset("2026-12-13", { offsetDays: 180 }).status).toBe(
      "valid",
    );
  });

  it("compares against start of day (same calendar day is daysRemaining 0)", () => {
    const late = deriveComplianceStatus({
      rule: { kind: "expiry_offset", offsetDays: 30 },
      expiryDate: "2026-06-15",
      now: new Date("2026-06-15T23:59:59.000Z"),
    });
    expect(late.daysRemaining).toBe(0);
    expect(late.status).toBe("critical");
  });
});

describe("deriveComplianceStatus — window", () => {
  it("returns unknown when windowOpenDate is null", () => {
    expect(windowRule(null, { windowCloseDate: "2026-07-01" })).toEqual({
      status: "unknown",
      daysRemaining: null,
      reference: "window",
    });
  });

  it("returns valid when now is before windowOpenDate", () => {
    expect(
      windowRule("2026-07-01", { windowCloseDate: "2026-09-01" }),
    ).toMatchObject({
      status: "valid",
      daysRemaining: 16, // 15 Jun → 1 Jul
      reference: "window",
    });
  });

  it("returns expired when now is after cutoff (windowCloseDate), never critical", () => {
    // Window closed yesterday — must be expired, not critical
    expect(
      windowRule("2026-05-01", { windowCloseDate: "2026-06-14" }),
    ).toMatchObject({
      status: "expired",
      reference: "window",
    });
  });

  it("uses expiryDate as cutoff when windowCloseDate is absent", () => {
    expect(
      windowRule("2026-05-01", { expiryDate: "2026-06-14" }),
    ).toMatchObject({ status: "expired" });
  });

  it("returns critical only in the final criticalDays before cutoff", () => {
    // Open May 1, close Jun 22; NOW Jun 15 → 7 days to cutoff → critical
    expect(
      windowRule("2026-05-01", { windowCloseDate: "2026-06-22" }),
    ).toMatchObject({
      status: "critical",
      reference: "window",
    });
  });

  it("returns expiring from windowOpenDate until the final critical stretch", () => {
    // Open May 1, close Aug 1; NOW Jun 15 → well inside window, >7d from close
    expect(
      windowRule("2026-05-01", { windowCloseDate: "2026-08-01" }),
    ).toMatchObject({
      status: "expiring",
      reference: "window",
    });
  });

  it("on the open day itself is inside the window (not still valid)", () => {
    expect(
      windowRule("2026-06-15", { windowCloseDate: "2026-08-01" }),
    ).toMatchObject({ status: "expiring" });
  });

  it("on the cutoff day is still inside (expired only after cutoff)", () => {
    // now === cutoff → not yet expired; final stretch → critical
    expect(
      windowRule("2026-05-01", { windowCloseDate: "2026-06-15" }),
    ).toMatchObject({ status: "critical" });
  });

  it("reports daysRemaining relative to windowOpenDate", () => {
    const before = windowRule("2026-07-01", {
      windowCloseDate: "2026-09-01",
    });
    expect(before.daysRemaining).toBe(16);

    const inside = windowRule("2026-05-01", {
      windowCloseDate: "2026-08-01",
    });
    expect(inside.daysRemaining).toBe(-45); // 15 Jun relative to 1 May
  });
});

describe("DEFAULT_CRITICAL_DAYS", () => {
  it("is 7 so 30d offsets keep distinct expiring vs critical tiers", () => {
    expect(DEFAULT_CRITICAL_DAYS).toBe(7);
  });
});

describe("isActionable", () => {
  it("is true only for expiring, critical, and expired", () => {
    const cases: Record<ComplianceStatus, boolean> = {
      valid: false,
      expiring: true,
      critical: true,
      expired: true,
      unknown: false,
      revoked: false,
    };
    for (const [status, expected] of Object.entries(cases)) {
      expect(isActionable(status as ComplianceStatus)).toBe(expected);
    }
  });
});

describe("compareBySeverity", () => {
  function result(status: ComplianceStatus, daysRemaining: number | null = 0): ComplianceResult {
    return { status, daysRemaining, reference: "expiry" };
  }

  it("orders worst-first: expired > critical > expiring > unknown > revoked > valid", () => {
    const ordered = [
      result("expired"),
      result("critical"),
      result("expiring"),
      result("unknown"),
      result("revoked"),
      result("valid"),
    ];
    const shuffled = [...ordered].reverse();
    shuffled.sort(compareBySeverity);
    expect(shuffled.map((r) => r.status)).toEqual(
      ordered.map((r) => r.status),
    );
  });

  it("breaks ties by fewer daysRemaining first (more urgent)", () => {
    const a = result("critical", 2);
    const b = result("critical", 7);
    expect(compareBySeverity(a, b)).toBeLessThan(0);
    expect(compareBySeverity(b, a)).toBeGreaterThan(0);
  });
});

describe("STATUS_LABELS and STATUS_STYLES", () => {
  it("covers every ComplianceStatus", () => {
    const statuses: ComplianceStatus[] = [
      "valid",
      "expiring",
      "critical",
      "expired",
      "unknown",
      "revoked",
    ];
    for (const s of statuses) {
      expect(STATUS_LABELS[s]).toBeTruthy();
      expect(STATUS_STYLES[s]).toBeTruthy();
    }
  });

  it("maps to ComplianceOne chip colors (compliant / at risk / non-compliant / neutral)", () => {
    expect(STATUS_STYLES.valid).toMatch(/DCFCE7|059669|34D399/i);
    expect(STATUS_STYLES.expiring).toMatch(/FEF3C7|D97706|FBBF24/i);
    expect(STATUS_STYLES.critical).toMatch(/FEF3C7|D97706|FBBF24/i);
    expect(STATUS_STYLES.expired).toMatch(/FEE2E2|DC2626|F87171/i);
    expect(STATUS_STYLES.unknown).toMatch(/F1F5F9|0F172A|gray/i);
    expect(STATUS_STYLES.revoked).toMatch(/F1F5F9|0F172A|gray/i);
  });

  it("visually distinguishes critical from plain expiring", () => {
    expect(STATUS_STYLES.critical).not.toBe(STATUS_STYLES.expiring);
  });
});
