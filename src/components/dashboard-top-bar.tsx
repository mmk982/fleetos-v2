import Link from "next/link";
import { getCompanyProfile } from "@/modules/settings/company-profile.controller";

/** Dashboard top bar — company logo + name per §7a. */
export async function DashboardTopBar() {
  const profile = await getCompanyProfile();
  const name = profile.companyName?.trim() || "FleetOS";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      <Link href="/dashboard" className="flex items-center gap-3">
        {profile.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/api/company-profile/logo"
            alt=""
            className="h-8 w-auto max-w-[10rem] object-contain"
          />
        ) : null}
        <span className="text-sm font-semibold tracking-tight text-[#0D2B45] dark:text-sky-100">
          {name}
        </span>
      </Link>
    </header>
  );
}
