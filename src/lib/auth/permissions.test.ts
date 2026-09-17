import { describe, expect, it } from "vitest";
import type { UserRole } from "@/db/schema";
import {
  getModuleAccess,
  MODULE_PERMISSIONS,
  VESSEL_SCOPED_MODULES,
  type ModuleAccess,
  type ModuleKey,
} from "./permissions";

const MODULE_KEYS = Object.keys(
  MODULE_PERMISSIONS.admin,
) as ModuleKey[];

describe("MODULE_PERMISSIONS matrix", () => {
  it("admin has write on every module", () => {
    for (const key of MODULE_KEYS) {
      expect(MODULE_PERMISSIONS.admin[key]).toBe("write");
    }
  });

  it("matches the confirmed Phase 6 cells for non-admin roles", () => {
    const expected: Record<
      Exclude<UserRole, "admin">,
      Partial<Record<ModuleKey, ModuleAccess>>
    > = {
      superintendent: {
        vessels: "none",
        certificates: "write",
        deficiencies: "write",
        crew: "write",
        insurance: "write",
        manuals: "write",
        drawings: "write",
        ism_templates: "write",
        monthly_forms: "write",
        particulars: "write",
        reminders: "write",
        alerts: "read",
        settings_users: "none",
        settings_general: "none",
        export: "write",
      },
      management_user: {
        vessels: "none",
        certificates: "read",
        deficiencies: "write",
        crew: "read",
        insurance: "read",
        manuals: "read",
        drawings: "read",
        ism_templates: "read",
        monthly_forms: "write",
        particulars: "read",
        reminders: "read",
        alerts: "read",
        settings_users: "none",
        settings_general: "none",
        export: "write",
      },
      vessel_user: {
        vessels: "none",
        certificates: "read",
        deficiencies: "read",
        crew: "read",
        insurance: "read",
        manuals: "read",
        drawings: "read",
        ism_templates: "read",
        monthly_forms: "write",
        particulars: "read",
        reminders: "read",
        alerts: "read",
        settings_users: "none",
        settings_general: "none",
        export: "none",
      },
      read_only: {
        vessels: "none",
        certificates: "read",
        deficiencies: "read",
        crew: "read",
        insurance: "read",
        manuals: "read",
        drawings: "read",
        ism_templates: "read",
        monthly_forms: "read",
        particulars: "read",
        reminders: "read",
        alerts: "read",
        settings_users: "none",
        settings_general: "none",
        export: "none",
      },
    };

    for (const role of Object.keys(expected) as Exclude<UserRole, "admin">[]) {
      for (const key of MODULE_KEYS) {
        expect(MODULE_PERMISSIONS[role][key]).toBe(expected[role][key]);
      }
    }
  });

  it("getModuleAccess returns none for null role", () => {
    expect(getModuleAccess(null, "certificates")).toBe("none");
  });

  it("VESSEL_SCOPED_MODULES excludes fleet-wide modules", () => {
    expect(VESSEL_SCOPED_MODULES.has("ism_templates")).toBe(false);
    expect(VESSEL_SCOPED_MODULES.has("alerts")).toBe(false);
    expect(VESSEL_SCOPED_MODULES.has("settings_users")).toBe(false);
    expect(VESSEL_SCOPED_MODULES.has("settings_general")).toBe(false);
    expect(VESSEL_SCOPED_MODULES.has("certificates")).toBe(true);
    expect(VESSEL_SCOPED_MODULES.has("export")).toBe(true);
  });
});
