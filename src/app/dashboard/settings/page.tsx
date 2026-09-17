import { CriticalDaysForm } from "@/components/settings-critical-days-form";
import { EmailDigestForm } from "@/components/settings-email-digest-form";
import { SettingsSubnav } from "@/components/settings-subnav";
import { requireSession } from "@/lib/auth/session";
import { getCriticalDays } from "@/lib/settings/critical-days";
import { getEmailDigestEnabled } from "@/lib/settings/email-digest";
import { STATUS_STYLES } from "@/lib/expiry";

export const dynamic = "force-dynamic";

/** Read-only 3-color legend — design constants, not settings-backed. */
function StatusColorsPanel() {
  const items = [
    { key: "valid" as const, label: "Valid" },
    { key: "expiring" as const, label: "Due Soon" },
    { key: "expired" as const, label: "Expired" },
  ];

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Status Colors
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Fixed compliance legend — not user-editable.
      </p>
      <ul className="mt-4 flex flex-wrap gap-3">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-normal ${STATUS_STYLES[item.key]}`}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SettingsGeneralPage() {
  await requireSession();
  const [criticalDays, emailDigestEnabled] = await Promise.all([
    getCriticalDays(),
    getEmailDigestEnabled(),
  ]);

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-8" dir="auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          General preferences for the fleet office.
        </p>
      </div>

      <SettingsSubnav />

      <div className="mt-6 grid max-w-3xl gap-6">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            General
          </h2>
          <CriticalDaysForm initialValue={criticalDays} />
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Email digest
          </h2>
          <EmailDigestForm initialEnabled={emailDigestEnabled} />
        </section>
        <StatusColorsPanel />
      </div>
    </main>
  );
}
