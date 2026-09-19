import { StatusPill } from "@/components/ui/status-pill";
import {
  MODULE_PERMISSIONS,
  type ModuleAccess,
  type ModuleKey,
} from "@/lib/auth/permissions";
import type { UserRole } from "@/db/schema";

const MODULE_LABELS: Record<ModuleKey, string> = {
  vessels: "Vessels",
  certificates: "Certificates",
  deficiencies: "Deficiencies",
  psc: "PSC",
  audits: "Audits",
  crew: "Crew",
  insurance: "Insurance",
  manuals: "Manuals",
  drawings: "Drawings",
  ism_templates: "ISM Templates",
  monthly_forms: "Monthly Executed Forms",
  particulars: "Particulars",
  reminders: "Reminders",
  alerts: "Alerts",
  settings_users: "Users & Roles",
  settings_general: "Settings",
  export: "Export",
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  superintendent: "Superintendent",
  management_user: "Management User",
  vessel_user: "Vessel User",
  read_only: "Read Only",
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Full access to every module, including user management and settings.",
  superintendent:
    "Full write access to fleet operations; no user or system settings.",
  management_user:
    "Vessel-scoped read access; write on deficiencies and monthly forms.",
  vessel_user: "Vessel-scoped read access; write on monthly forms only.",
  read_only: "Read-only access everywhere, no exports.",
};

const ACCESS_TONE: Record<ModuleAccess, "success" | "warning" | "neutral"> = {
  write: "success",
  read: "warning",
  none: "neutral",
};

/** Read-only role matrix derived from {@link MODULE_PERMISSIONS} (can't drift). */
export function RoleReference() {
  const roles = Object.keys(MODULE_PERMISSIONS) as UserRole[];
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">
        Role permissions
      </h2>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">
        Reference only — enforced server-side, not editable here.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {roles.map((role) => (
          <div
            key={role}
            className="rounded-xl border border-[var(--border)] p-4"
          >
            <h3 className="font-semibold text-[var(--text-primary)]">
              {ROLE_LABELS[role]}
            </h3>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              {ROLE_DESCRIPTIONS[role]}
            </p>
            <ul className="mt-3 space-y-1">
              {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((key) => {
                const access = MODULE_PERMISSIONS[role][key];
                if (access === "none") return null;
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-[var(--text-secondary)]">
                      {MODULE_LABELS[key]}
                    </span>
                    <StatusPill tone={ACCESS_TONE[access]} dot>
                      {access}
                    </StatusPill>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
