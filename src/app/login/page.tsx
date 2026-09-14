import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { getCompanyProfile } from "@/modules/settings/company-profile.controller";

/**
 * Login screen — created in Phase 3 (was incorrectly assumed to already
 * exist from a design phase). Single email/password form wired to
 * `loginAction`. Company logo/name from Company Profile (§7a).
 *
 * Gap (explicit, this slice): English + default theme only — full light/dark
 * and EN/AR coverage from DESIGN_HANDOFF.md §5 is deferred.
 */
export const metadata: Metadata = {
  title: "Sign in — FleetOS",
};

export default async function LoginPage() {
  const profile = await getCompanyProfile();
  const brand = profile.companyName?.trim() || "FleetOS";

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6">
          {profile.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/api/company-profile/logo"
              alt=""
              className="mb-4 h-12 w-auto max-w-full object-contain"
            />
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {brand}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Use your fleet-office account to continue.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
