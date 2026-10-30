/**
 * Certificate data-access layer.
 *
 * Only file in this module allowed to import drizzle-orm query builders.
 * Every public method takes {@link AccessContext} and calls
 * {@link assertAuthenticatedAccess}, then {@link assertModuleAccess} /
 * {@link assertVesselScope} as needed. Live status always comes from
 * `deriveComplianceStatus` — `cachedStatus` is a non-authoritative write-side cache.
 *
 * Spec: PROJECT_PLAN.md §1.
 */
export type { CertificateListItem } from "./certificate.model";

export {
  AttachmentNotFoundError,
  AttachmentValidationError,
  CertificateConflictError,
  CertificateNotFoundError,
  CertificateTypeNotFoundError,
  IssuingAuthorityNotFoundError,
} from "./certificate.shared";

export {
  createCertificateType,
  createIssuingAuthority,
  deleteCertificateType,
  deleteIssuingAuthority,
  listCertificateTypes,
  listIssuingAuthorities,
  updateCertificateType,
  updateIssuingAuthority,
} from "./certificate.lookups";

export {
  getCertificateById,
  listCertificates,
  listParentCandidates,
  listSubCertificates,
  requireCertificateById,
} from "./certificate.queries";
export type {
  CertificateDetail,
  CertificateListFilters,
  ParentCertificateCandidate,
} from "./certificate.queries";

export {
  createCertificate,
  deleteCertificate,
  updateCertificate,
} from "./certificate.mutations";

export { addCertificateEvent } from "./certificate.events";

export {
  deleteCertificateAttachment,
  getCertificateAttachmentById,
  openAttachmentStream,
  uploadCertificateAttachment,
} from "./certificate.attachments";
