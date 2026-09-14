/**
 * Users & Roles admin table + kebab actions (`PROJECT_PLAN.md` §7a).
 */
"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  changeUserPasswordAction,
  createUserAction,
  setUserActiveAction,
  updateUserAction,
  type UsersActionState,
} from "@/modules/settings/users-actions";
import {
  roleRequiresVessel,
  USER_ROLE_LABELS,
} from "@/modules/settings/users.model";
import type { UserListItem } from "@/modules/settings/users.model";
import { userRoleEnum, type UserRole, type VesselRow } from "@/db/schema";

const ROLE_LEGEND: { role: UserRole; blurb: string }[] = [
  { role: "admin", blurb: "Full access including Users & Roles and vessel registry." },
  {
    role: "superintendent",
    blurb: "Office-based, fleet-wide compliance access (no Users & Roles).",
  },
  {
    role: "management_user",
    blurb: "Vessel-scoped — tied to exactly one vessel.",
  },
  {
    role: "vessel_user",
    blurb: "Vessel-scoped — tied to exactly one vessel; narrower write rights.",
  },
  { role: "read_only", blurb: "Office-based, fleet-wide read access." },
];

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

function formatLastLogin(d: Date | string | null): string {
  if (!d) return "Never";
  return new Date(d).toLocaleString();
}

export function UsersRolesPanel({
  users,
  vessels,
}: {
  users: UserListItem[];
  vessels: VesselRow[];
}) {
  const router = useRouter();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { kind: "closed" }
    | { kind: "create" }
    | { kind: "edit"; user: UserListItem }
    | { kind: "password"; user: UserListItem }
  >({ kind: "closed" });
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <div className="mt-6 space-y-6">
      {flash ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200">
          {flash}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setDialog({ kind: "create" })}
          className="inline-flex h-10 items-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
        >
          Add User
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {users.map((u) => (
              <tr key={u.id} className="bg-white dark:bg-zinc-950">
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                  {u.name}
                  {u.vesselName ? (
                    <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                      {u.vesselName}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {u.email}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {USER_ROLE_LABELS[u.role]}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${
                      u.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {formatLastLogin(u.lastLoginAt)}
                </td>
                <td className="relative px-4 py-3 text-right">
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    aria-label={`Actions for ${u.name}`}
                    onClick={() =>
                      setMenuId((cur) => (cur === u.id ? null : u.id))
                    }
                  >
                    ⋮
                  </button>
                  {menuId === u.id ? (
                    <div className="absolute end-4 z-10 mt-1 w-44 rounded-md border border-zinc-200 bg-white py-1 text-start shadow-md dark:border-zinc-700 dark:bg-zinc-900">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        onClick={() => {
                          setMenuId(null);
                          setDialog({ kind: "edit", user: u });
                        }}
                      >
                        Edit User
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        onClick={() => {
                          setMenuId(null);
                          setDialog({ kind: "password", user: u });
                        }}
                      >
                        Change Password
                      </button>
                      <form
                        action={async (fd) => {
                          const result = await setUserActiveAction(fd);
                          setMenuId(null);
                          if (result.ok) {
                            setFlash(result.message ?? null);
                            router.refresh();
                          } else {
                            setFlash(result.message);
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={u.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={u.isActive ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          className="block w-full px-3 py-2 text-start text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Role reference
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Static legend — permission cells with *(inferred)* remain unconfirmed;
          this page does not enforce the full Phase 6 matrix.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {ROLE_LEGEND.map((item) => (
            <li key={item.role}>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {USER_ROLE_LABELS[item.role]}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                {" — "}
                {item.blurb}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {dialog.kind === "create" ? (
        <UserDialog
          title="Add User"
          vessels={vessels}
          onClose={() => setDialog({ kind: "closed" })}
          onSuccess={(msg) => {
            setFlash(msg);
            setDialog({ kind: "closed" });
          }}
          mode="create"
        />
      ) : null}
      {dialog.kind === "edit" ? (
        <UserDialog
          title="Edit User"
          vessels={vessels}
          user={dialog.user}
          onClose={() => setDialog({ kind: "closed" })}
          onSuccess={(msg) => {
            setFlash(msg);
            setDialog({ kind: "closed" });
          }}
          mode="edit"
        />
      ) : null}
      {dialog.kind === "password" ? (
        <PasswordDialog
          user={dialog.user}
          onClose={() => setDialog({ kind: "closed" })}
          onSuccess={(msg) => {
            setFlash(msg);
            setDialog({ kind: "closed" });
          }}
        />
      ) : null}
    </div>
  );
}

function UserDialog({
  title,
  vessels,
  user,
  mode,
  onClose,
  onSuccess,
}: {
  title: string;
  vessels: VesselRow[];
  user?: UserListItem;
  mode: "create" | "edit";
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const router = useRouter();
  const action = mode === "create" ? createUserAction : updateUserAction;
  const [state, formAction, pending] = useActionState(
    action as (
      prev: UsersActionState | undefined,
      formData: FormData,
    ) => Promise<UsersActionState>,
    undefined,
  );
  const [role, setRole] = useState<UserRole>(user?.role ?? "read_only");

  useEffect(() => {
    if (state?.ok) {
      onSuccess(state.message ?? "Saved.");
      router.refresh();
    }
  }, [state, onSuccess, router]);

  return (
    <ModalShell title={title} onClose={onClose}>
      <form action={formAction} className="space-y-3">
        {user ? <input type="hidden" name="id" value={user.id} /> : null}
        {state && !state.ok ? (
          <p className="text-sm text-red-600" role="alert">
            {state.message}
          </p>
        ) : null}
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            name="name"
            required
            defaultValue={user?.name ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={user?.email ?? ""}
            className={inputClass}
          />
        </div>
        {mode === "create" ? (
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className={inputClass}
            />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-sm font-medium">Role</label>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={inputClass}
          >
            {userRoleEnum.map((r) => (
              <option key={r} value={r}>
                {USER_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {roleRequiresVessel(role) ? (
          <div>
            <label className="mb-1 block text-sm font-medium">Vessel</label>
            <select
              name="vesselId"
              required
              defaultValue={user?.vesselId ?? ""}
              className={inputClass}
            >
              <option value="">Select vessel…</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="vesselId" value="" />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[#378ADD] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function PasswordDialog({
  user,
  onClose,
  onSuccess,
}: {
  user: UserListItem;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    changeUserPasswordAction as (
      prev: UsersActionState | undefined,
      formData: FormData,
    ) => Promise<UsersActionState>,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      onSuccess(state.message ?? "Password updated.");
      router.refresh();
    }
  }, [state, onSuccess, router]);

  return (
    <ModalShell title={`Change password — ${user.name}`} onClose={onClose}>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={user.id} />
        {state && !state.ok ? (
          <p className="text-sm text-red-600" role="alert">
            {state.message}
          </p>
        ) : null}
        <div>
          <label className="mb-1 block text-sm font-medium">New password</label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className={inputClass}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[#378ADD] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Update password"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
