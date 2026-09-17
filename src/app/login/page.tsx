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
    <main className="flex min-h-full flex-1 items-center justify-center bg-[var(--bg-page)] px-4 py-12">
      <div className="w-full max-w-sm rounded-none border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm">
        <div className="mb-6">
          {profile.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/api/company-profile/logo"
              alt=""
              className="mb-4 h-12 w-auto max-w-full object-contain"
            />
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            {brand}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Use your fleet-office account to continue.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
