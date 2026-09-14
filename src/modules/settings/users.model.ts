/**
 * Users & Roles presentation helpers — safe for client components.
 */
import { userRoleEnum, type UserRole } from "@/db/schema";

export const USER_ROLES = userRoleEnum;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  management_user: "Management User",
  superintendent: "Superintendent",
  vessel_user: "Vessel User",
  read_only: "Read Only",
};

const VESSEL_SCOPED: readonly UserRole[] = ["management_user", "vessel_user"];

export function roleRequiresVessel(role: UserRole): boolean {
  return VESSEL_SCOPED.includes(role);
}

/** List-row shape for the Users & Roles table (safe for client props). */
export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  vesselId: string | null;
  vesselName: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
};
