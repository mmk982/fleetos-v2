/**
 * Quick-view drawer for a certificate row (optional entry from the list).
 * Demonstrates the shared Drawer primitive on the Certificates surface.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Identifier } from "@/components/ui/identifier";
import { StatusPill } from "@/components/ui/status-pill";
import type { CertificateListItem } from "@/modules/certificates/certificate.model";

export function CertificateQuickView({ row }: { row: CertificateListItem }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        View
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={row.typeName}>
        <div className="space-y-4 text-sm">
          <StatusPill status={row.compliance.status} />
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Vessel
              </dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                <Identifier>{row.vesselName}</Identifier>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Number
              </dt>
              <dd className="mt-1 font-mono text-zinc-900 dark:text-zinc-100">
                <Identifier>{row.certificateNumber ?? "—"}</Identifier>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Expiry / window
              </dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {row.ruleKind === "window"
                  ? (row.windowOpenDate ?? "—")
                  : (row.expiryDate ?? "—")}
              </dd>
            </div>
          </dl>
          <Link
            href={`/dashboard/certificates/${row.id}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#378ADD] px-4 text-sm font-medium text-white"
            onClick={() => setOpen(false)}
          >
            Open detail
          </Link>
        </div>
      </Drawer>
    </>
  );
}
