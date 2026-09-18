import { SettingsSubnav } from "@/components/settings-subnav";
import { RoleReference } from "@/components/role-reference";
import { UsersRolesPanel } from "@/components/users-roles-panel";
import { ForbiddenError, toAccessContext } from "@/lib/auth/access";
import { requireSession } from "@/lib/auth/session";
import type { UserListItem } from "@/modules/settings/users.model";
import { listUsers } from "@/modules/settings/users.controller";
import { listSelectableVessels } from "@/modules/vessels/vessel.controller";
import type { VesselRow } from "@/db/schema";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UsersRolesPage() {
  const session = await requireSession();
  const access = toAccessContext(session);

  let data: { users: UserListItem[]; vessels: VesselRow[] } | null = null;
  try {
    const [users, vessels] = await Promise.all([
      listUsers(access),
      listSelectableVessels(access),
    ]);
    data = { users, vessels };
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
  }

  if (!data) {
    return (
      <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
        <SettingsSubnav />
        <div className="mt-6 rounded-xl border border-[var(--warning)]/30 bg-[color-mix(in_oklab,var(--warning)_10%,white)] px-4 py-6 text-sm text-[var(--text-primary)] dark:bg-[var(--warning)]/20">
          <p className="font-medium">Admin access required</p>
          <p className="mt-1">
            Only Admin users can manage Users & Roles.{" "}
            <Link
              href="/dashboard/settings"
              className="underline underline-offset-2"
            >
              Back to General
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Users & Roles — Admin only.
        </p>
      </div>

      <SettingsSubnav />
      <UsersRolesPanel users={data.users} vessels={data.vessels} />
      <div className="mt-6">
        <RoleReference />
      </div>
    </main>
  );
}
