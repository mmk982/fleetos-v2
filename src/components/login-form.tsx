"use client";

/**
 * Login form — client boundary for `useActionState` + `loginAction`.
 *
 * Styling follows the same zinc / `#0D2B45` token classes as
 * `vessel-form.tsx` (current codebase design system), aligned with
 * DESIGN_HANDOFF.md §4 form-field structure (label above input, primary
 * filled action). Gap (explicit): light/dark polish pass and EN/AR locale
 * strings are deferred — this is default-theme English only for this slice.
 */
import { useActionState } from "react";
import { loginAction, type LoginActionState } from "@/modules/auth/actions";

const labelClass = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#0D2B45] focus:ring-1 focus:ring-[#0D2B45] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const errorText = "mt-1 text-sm text-red-600 dark:text-red-400";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction as (
      prev: LoginActionState | undefined,
      formData: FormData,
    ) => Promise<LoginActionState>,
    undefined,
  );

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={320}
          className={inputClass}
        />
        {fieldErrors?.email ? (
          <p className={errorText}>{fieldErrors.email.join(" ")}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
          className={inputClass}
        />
        {fieldErrors?.password ? (
          <p className={errorText}>{fieldErrors.password.join(" ")}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#0D2B45] px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
