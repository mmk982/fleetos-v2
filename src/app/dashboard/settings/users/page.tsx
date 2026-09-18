import { SettingsSubnav } from "@/components/settings-subnav";
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
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Users & Roles — Admin only.
        </p>
      </div>

      <SettingsSubnav />
      <UsersRolesPanel users={data.users} vessels={data.vessels} />
    </main>
  );
}
