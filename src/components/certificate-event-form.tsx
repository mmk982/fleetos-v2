"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import {
  addCertificateEventAction,
  type CertificateActionState,
} from "@/modules/certificates/actions";
import { CERTIFICATE_EVENT_TYPES } from "@/modules/certificates/certificate.model";

const labelClass = "mb-1 block text-sm font-medium text-[var(--text-secondary)]";
const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[#378ADD] focus:ring-1 focus:ring-[#378ADD]";

type Props = { certificateId: string };

export function CertificateEventForm({ certificateId }: Props) {
  const [state, formAction, pending] = useActionState(
    addCertificateEventAction,
    undefined as CertificateActionState | undefined,
  );

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-[var(--border)] p-4">
      <input type="hidden" name="certificateId" value={certificateId} />
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add event</h3>
      {state && !state.ok ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.message}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-green-700 dark:text-green-400">Event recorded.</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="eventType" className={labelClass}>
            Type
          </label>
          <select id="eventType" name="eventType" required className={inputClass} defaultValue="issued">
            {CERTIFICATE_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="eventDate" className={labelClass}>
            Event date
          </label>
          <input id="eventDate" name="eventDate" type="date" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="newExpiryDate" className={labelClass}>
            New expiry (extend / renew)
          </label>
          <input id="newExpiryDate" name="newExpiryDate" type="date" className={inputClass} />
        </div>
        <div>
          <label htmlFor="note" className={labelClass}>
            Note
          </label>
          <input id="note" name="note" className={inputClass} autoComplete="off" />
        </div>
      </div>
      <Button variant="primary" type="submit"
        disabled={pending}>
        {pending ? "Saving…" : "Add event"}
      </Button>
    </form>
  );
}
