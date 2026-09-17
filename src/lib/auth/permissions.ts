/**
 * Phase 6 RBAC permission matrix (`MASTER_IMPLEMENTATION_PLAN.md` Phase 6).
 *
 * Binary allow/deny per module — no "limited" tier. Finer carve-outs inside
 * deficiencies / monthly_forms (log-vs-full-write, submit-vs-upload) are
 * Stage 3; this table only encodes coarse none / read / write.
 *
 * Safe for client + server imports (sidebar gating).
 */
import type { UserRole } from "@/db/schema";

export type ModuleKey =
  | "vessels"
  | "certificates"
  | "deficiencies"
  | "crew"
  | "insurance"
  | "manuals"
  | "drawings"
  | "ism_templates"
  | "monthly_forms"
  | "particulars"
  | "reminders"
  | "alerts"
  | "settings_users"
  | "settings_general"
  | "export";

export type ModuleAccess = "none" | "read" | "write";

const ALL_WRITE = {
  vessels: "write",
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
  alerts: "write",
  settings_users: "write",
  settings_general: "write",
  export: "write",
} as const satisfies Record<ModuleKey, ModuleAccess>;

/**
 * Confirmed Eng.MHD matrix (2026-09-17). Parenthetical table notes
 * ("log & update", "submit", "Submit only", "R, no upload") collapse to
 * write/read here — Stage 3 owns the finer gates.
 */
export const MODULE_PERMISSIONS: Record<
  UserRole,
  Record<ModuleKey, ModuleAccess>
> = {
  admin: { ...ALL_WRITE },
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

/**
 * Modules whose rows are vessel-scoped. Fleet-wide / office-only modules
 * (`ism_templates`, `alerts`, `settings_users`, `settings_general`) are
 * excluded — {@link assertVesselScope} is not applied for those.
 */
export const VESSEL_SCOPED_MODULES: ReadonlySet<ModuleKey> = new Set([
  "vessels",
  "certificates",
  "deficiencies",
  "crew",
  "insurance",
  "manuals",
  "drawings",
  "monthly_forms",
  "particulars",
  "reminders",
  "export",
]);

const ACCESS_RANK: Record<ModuleAccess, number> = {
  none: 0,
  read: 1,
  write: 2,
};

/**
 * Looks up coarse module access for a role. Null role → `"none"` (never throws).
 */
export function getModuleAccess(
  role: UserRole | null,
  moduleKey: ModuleKey,
): ModuleAccess {
  if (role === null) return "none";
  return MODULE_PERMISSIONS[role][moduleKey];
}

/**
 * Whether `granted` satisfies `required` (`write` implies `read`).
 */
export function accessMeetsRequirement(
  granted: ModuleAccess,
  required: "read" | "write",
): boolean {
  return ACCESS_RANK[granted] >= ACCESS_RANK[required];
}
