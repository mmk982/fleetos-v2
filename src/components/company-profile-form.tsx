"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import {
  clearCompanyLogoAction,
  updateCompanyProfileAction,
  uploadCompanyLogoAction,
  type SettingsActionState,
} from "@/modules/settings/actions";
import type { CompanyProfileRow } from "@/db/schema";

const labelClass =
  "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";

export function CompanyProfileForm({
  profile,
}: {
  profile: CompanyProfileRow;
}) {
  const [state, formAction, pending] = useActionState(
    updateCompanyProfileAction as (
      prev: SettingsActionState | undefined,
      formData: FormData,
    ) => Promise<SettingsActionState>,
    undefined,
  );
  const [logoState, logoAction, logoPending] = useActionState(
    uploadCompanyLogoAction as (
      prev: SettingsActionState | undefined,
      formData: FormData,
    ) => Promise<SettingsActionState>,
    undefined,
  );

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-4">
        {state && !state.ok ? (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {state.message}
          </div>
        ) : null}
        {state?.ok ? (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200">
            {state.message ?? "Saved."}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="companyName" className={labelClass}>
              Company name
            </label>
            <input
              id="companyName"
              name="companyName"
              defaultValue={profile.companyName ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="registrationNumber" className={labelClass}>
              Registration number
            </label>
            <input
              id="registrationNumber"
              name="registrationNumber"
              defaultValue={profile.registrationNumber ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="contactEmail" className={labelClass}>
              Contact email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={profile.contactEmail ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="contactPhone" className={labelClass}>
              Contact phone
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              defaultValue={profile.contactPhone ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="timezone" className={labelClass}>
              Timezone
            </label>
            <input
              id="timezone"
              name="timezone"
              placeholder="e.g. Asia/Dubai"
              defaultValue={profile.timezone ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="dateFormat" className={labelClass}>
              Date format
            </label>
            <input
              id="dateFormat"
              name="dateFormat"
              placeholder="e.g. YYYY-MM-DD"
              defaultValue={profile.dateFormat ?? ""}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="address" className={labelClass}>
              Address
            </label>
            <textarea
              id="address"
              name="address"
              rows={3}
              defaultValue={profile.address ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <Button variant="primary" type="submit"
          disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <section className="border-t border-[var(--border)] pt-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Company logo
        </h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Shown on the login page and dashboard top bar. JPEG or PNG, max 10 MB.
        </p>

        {profile.logoPath ? (
          <div className="mt-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/company-profile/logo"
              alt="Company logo"
              className="h-16 w-auto max-w-[12rem] object-contain"
            />
            <form action={clearCompanyLogoAction}>
              <Button variant="destructive" type="submit">
                Remove logo
              </Button>
            </form>
          </div>
        ) : null}

        <form action={logoAction} className="mt-4 flex flex-wrap items-end gap-3">
          {logoState && !logoState.ok ? (
            <p className="w-full text-sm text-red-600" role="alert">
              {logoState.message}
            </p>
          ) : null}
          {logoState?.ok ? (
            <p className="w-full text-sm text-green-700">{logoState.message}</p>
          ) : null}
          <div>
            <label htmlFor="logo" className={labelClass}>
              Upload logo
            </label>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/jpeg,image/png"
              required
              className="block text-sm"
            />
          </div>
          <Button variant="secondary" type="submit"
            disabled={logoPending}>
            {logoPending ? "Uploading…" : "Upload"}
          </Button>
        </form>
      </section>
    </div>
  );
}
