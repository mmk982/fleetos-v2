/**
 * Quick-view drawer for a certificate row (optional entry from the list).
 * Demonstrates the shared Drawer primitive on the Certificates surface.
 */
"use client";

import { Button } from "@/components/ui/button";
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
      <Button variant="secondary" type="button"
        onClick={() => setOpen(true)}>
        View
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={row.typeName}>
        <div className="space-y-4 text-sm">
          <StatusPill status={row.compliance.status} />
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Vessel
              </dt>
              <dd className="mt-1 text-[var(--text-primary)]">
                <Identifier>{row.vesselName}</Identifier>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Number
              </dt>
              <dd className="mt-1 font-mono text-[var(--text-primary)]">
                <Identifier mono>{row.certificateNumber ?? "—"}</Identifier>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Expiry / window
              </dt>
              <dd className="mt-1 text-[var(--text-primary)]">
                {row.ruleKind === "window"
                  ? (row.windowOpenDate ?? "—")
                  : (row.expiryDate ?? "—")}
              </dd>
            </div>
          </dl>
          <Link
            href={`/dashboard/certificates/${row.id}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
            onClick={() => setOpen(false)}
          >
            Open detail
          </Link>
        </div>
      </Drawer>
    </>
  );
}
