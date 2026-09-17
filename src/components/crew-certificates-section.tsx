"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CrewCertificateAttachments } from "@/components/crew-certificate-attachments";
import { CrewCertificateForm } from "@/components/crew-certificate-form";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Identifier } from "@/components/ui/identifier";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { deleteCrewCertificateFormAction } from "@/modules/crew/actions";
import type { CrewCertificateListItem } from "@/modules/crew/crew.model";
import type {
  CrewCertificateAttachmentRow,
  EndorsementTypeRow,
} from "@/db/schema";

type CertWithAttachments = CrewCertificateListItem & {
  attachments: CrewCertificateAttachmentRow[];
};

type ModalMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; cert: CrewCertificateListItem };

export function CrewCertificatesSection({
  crewMemberId,
  certificates,
  endorsementTypes,
}: {
  crewMemberId: string;
  certificates: CertWithAttachments[];
  endorsementTypes: EndorsementTypeRow[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalMode>({ kind: "closed" });

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Certificates & documents
        </h2>
        <button
          type="button"
          onClick={() => setModal({ kind: "create" })}
          className="inline-flex h-9 items-center rounded-md bg-[#378ADD] px-3 text-sm font-medium text-white"
        >
          Add document
        </button>
      </div>

      {certificates.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
          No documents yet — passport, STCW, medical, visas go here.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {certificates.map((cert) => (
            <li
              key={cert.id}
              className="rounded-lg border border-[var(--border)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    {cert.name}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                    {cert.documentNumber ? (
                      <>
                        <Identifier>{cert.documentNumber}</Identifier>
                        {" · "}
                      </>
                    ) : null}
                    Expiry {cert.expiryDate ?? "—"}
                    {cert.endorsementTypeName
                      ? ` · ${cert.endorsementTypeName}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={cert.compliance.status} />
                  <button
                    type="button"
                    className="text-sm font-medium text-[#378ADD] underline-offset-2 hover:underline"
                    onClick={() => setModal({ kind: "edit", cert })}
                  >
                    Edit
                  </button>
                  <ConfirmDeleteButton
                    label="Delete"
                    title="Delete document?"
                    description="Removes this certificate and its attachment files."
                    id={cert.id}
                    action={async (fd) => {
                      fd.set("crewMemberId", crewMemberId);
                      await deleteCrewCertificateFormAction(fd);
                      router.refresh();
                    }}
                  />
                </div>
              </div>
              <CrewCertificateAttachments
                crewMemberId={crewMemberId}
                crewCertificateId={cert.id}
                attachments={cert.attachments}
              />
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modal.kind !== "closed"}
        onClose={() => setModal({ kind: "closed" })}
        ariaLabel={
          modal.kind === "edit" ? "Edit crew document" : "Add crew document"
        }
      >
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          {modal.kind === "edit" ? "Edit document" : "Add document"}
        </h2>
        <div className="mt-4">
          {modal.kind === "create" ? (
            <CrewCertificateForm
              mode="create"
              crewMemberId={crewMemberId}
              endorsementTypes={endorsementTypes}
              onCancel={() => setModal({ kind: "closed" })}
              onSuccess={() => {
                setModal({ kind: "closed" });
                router.refresh();
              }}
            />
          ) : null}
          {modal.kind === "edit" ? (
            <CrewCertificateForm
              mode="edit"
              crewMemberId={crewMemberId}
              certificate={modal.cert}
              endorsementTypes={endorsementTypes}
              onCancel={() => setModal({ kind: "closed" })}
              onSuccess={() => {
                setModal({ kind: "closed" });
                router.refresh();
              }}
            />
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
