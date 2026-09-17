import { CompanyProfileForm } from "@/components/company-profile-form";
import { SettingsSubnav } from "@/components/settings-subnav";
import { requireSession } from "@/lib/auth/session";
import { getCompanyProfile } from "@/modules/settings/company-profile.controller";

export const dynamic = "force-dynamic";

export default async function CompanyProfilePage() {
  await requireSession();
  const profile = await getCompanyProfile();

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Company identity shown on login and the dashboard top bar.
        </p>
      </div>

      <SettingsSubnav />

      <div className="mt-6 max-w-2xl rounded-none border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Company Profile
        </h2>
        <CompanyProfileForm profile={profile} />
      </div>
    </main>
  );
}
