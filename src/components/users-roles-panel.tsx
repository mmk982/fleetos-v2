/**
 * Users & Roles admin table + kebab actions (`PROJECT_PLAN.md` §7a).
 */
"use client";

import { Button } from "@/components/ui/button";
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
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";

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
        <Button variant="primary" type="button"
          onClick={() => setDialog({ kind: "create" })}>
          Add User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--bg-page)] text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((u) => (
              <tr key={u.id} className="bg-[var(--bg-card)]">
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                  {u.name}
                  {u.vesselName ? (
                    <span className="mt-0.5 block text-xs font-normal text-[var(--text-tertiary)]">
                      {u.vesselName}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {u.email}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {USER_ROLE_LABELS[u.role]}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${
                      u.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                        : "bg-[var(--bg-page)] text-[var(--text-secondary)]  "
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {formatLastLogin(u.lastLoginAt)}
                </td>
                <td className="relative px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    type="button"
                    aria-label={`Actions for ${u.name}`}
                    onClick={() =>
                      setMenuId((cur) => (cur === u.id ? null : u.id))
                    }
                  >
                    ⋮
                  </Button>
                  {menuId === u.id ? (
                    <div className="absolute end-4 z-10 mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-1 text-start shadow-md">
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          setMenuId(null);
                          setDialog({ kind: "edit", user: u });
                        }}
                        className="w-full justify-start"
                      >
                        Edit User
                      </Button>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          setMenuId(null);
                          setDialog({ kind: "password", user: u });
                        }}
                        className="w-full justify-start"
                      >
                        Change Password
                      </Button>
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
                        <Button
                          variant={u.isActive ? "destructive" : "ghost"}
                          type="submit"
                          className="w-full justify-start"
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Role reference
        </h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Static legend — permission cells with *(inferred)* remain unconfirmed;
          this page does not enforce the full Phase 6 matrix.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {ROLE_LEGEND.map((item) => (
            <li key={item.role}>
              <span className="font-medium text-[var(--text-primary)]">
                {USER_ROLE_LABELS[item.role]}
              </span>
              <span className="text-[var(--text-secondary)]">
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
          <Button variant="secondary" type="button"
            onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit"
            disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
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
          <Button variant="secondary" type="button"
            onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit"
            disabled={pending}>
            {pending ? "Saving…" : "Update password"}
          </Button>
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
        className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-lg"
      >
        <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
