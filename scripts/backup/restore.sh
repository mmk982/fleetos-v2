#!/usr/bin/env bash
# Restore an age-encrypted FleetOS backup bundle into an EXPLICIT target.
# Refuses to use the live production DB unless
#   --i-know-this-overwrites-production
# is passed.
#
# Usage:
#   AGE_IDENTITY=/path/to/key.txt \
#   TARGET_DATABASE_URL=postgres://… \
#   TARGET_ATTACHMENTS_DIR=/path/to/empty/dir \
#   ./restore.sh /path/to/fleetos-….tar.age [--i-know-this-overwrites-production]
set -euo pipefail

log() { printf '[restore] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "missing dependency: $1"; }

need age
need tar
need pg_restore
need psql
if command -v sha256sum >/dev/null 2>&1; then
  SHA_CMD=(sha256sum -c)
elif command -v shasum >/dev/null 2>&1; then
  SHA_CMD=(shasum -a 256 -c)
else
  die "missing sha256sum or shasum"
fi

FORCE=0
BUNDLE=""
for arg in "$@"; do
  case "${arg}" in
    --i-know-this-overwrites-production) FORCE=1 ;;
    -*) die "unknown flag: ${arg}" ;;
    *) BUNDLE="${arg}" ;;
  esac
done

[[ -n "${BUNDLE}" ]] || die "usage: restore.sh <bundle.tar.age> [--i-know-this-overwrites-production]"
[[ -f "${BUNDLE}" ]] || die "bundle not found: ${BUNDLE}"
[[ -n "${AGE_IDENTITY:-}" ]] || die "AGE_IDENTITY (path to age private key file) is required"
[[ -f "${AGE_IDENTITY}" ]] || die "AGE_IDENTITY file not found"
[[ -n "${TARGET_DATABASE_URL:-}" ]] || die "TARGET_DATABASE_URL is required"
[[ -n "${TARGET_ATTACHMENTS_DIR:-}" ]] || die "TARGET_ATTACHMENTS_DIR is required"

# Refuse accidental prod overwrite: if TARGET looks like the live migrate URL
# and FORCE is unset, abort. Human must pass the explicit flag.
if [[ "${FORCE}" -ne 1 ]]; then
  if [[ -n "${DATABASE_MIGRATE_URL:-}" && "${TARGET_DATABASE_URL}" == "${DATABASE_MIGRATE_URL}" ]]; then
    die "TARGET_DATABASE_URL matches DATABASE_MIGRATE_URL (live). Pass --i-know-this-overwrites-production to proceed."
  fi
  # Compose service hostname + canonical DB name — scratch DBs (e.g. fleetos_restore_*) are allowed.
  if [[ "${TARGET_DATABASE_URL}" == *"@postgres:5432/fleetos" && "${TARGET_DATABASE_URL}" != *"@postgres:5432/fleetos_"* ]]; then
    die "TARGET_DATABASE_URL points at compose service 'postgres'/fleetos (likely live). Pass --i-know-this-overwrites-production to proceed."
  fi
fi

CHECKSUM_FILE="${BUNDLE}.sha256"
[[ -f "${CHECKSUM_FILE}" ]] || die "checksum file missing: ${CHECKSUM_FILE}"

log "verifying checksum…"
(
  cd "$(dirname "${BUNDLE}")"
  "${SHA_CMD[@]}" "$(basename "${CHECKSUM_FILE}")"
) || die "checksum verification failed"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/fleetos-restore.XXXXXX")"
trap 'rm -rf "${WORK}"' EXIT

log "decrypting…"
age -d -i "${AGE_IDENTITY}" -o "${WORK}/bundle.tar" "${BUNDLE}"
tar -C "${WORK}" -xf "${WORK}/bundle.tar"

[[ -f "${WORK}/db.dump" ]] || die "db.dump missing from bundle"
[[ -f "${WORK}/attachments.tar" ]] || die "attachments.tar missing from bundle"

log "restoring database into TARGET_DATABASE_URL…"
# Drop/recreate public schema objects via pg_restore --clean where possible.
pg_restore --dbname="${TARGET_DATABASE_URL}" --clean --if-exists --no-owner --no-acl "${WORK}/db.dump" \
  || log "pg_restore exited non-zero (often OK with --clean on empty DB); continuing to sanity checks"

log "restoring attachments into ${TARGET_ATTACHMENTS_DIR}…"
mkdir -p "${TARGET_ATTACHMENTS_DIR}"
# attachments.tar contains a top-level directory named like the original basename
tar -C "$(dirname "${TARGET_ATTACHMENTS_DIR}")" -xf "${WORK}/attachments.tar"
# If tar extracted to a sibling name, move into place
BASE="$(basename "${TARGET_ATTACHMENTS_DIR}")"
PARENT="$(dirname "${TARGET_ATTACHMENTS_DIR}")"
if [[ -d "${PARENT}/attachments" && "${BASE}" != "attachments" ]]; then
  rm -rf "${TARGET_ATTACHMENTS_DIR}"
  mv "${PARENT}/attachments" "${TARGET_ATTACHMENTS_DIR}"
fi

log "sanity queries…"
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'users' AS table_name, count(*)::bigint AS n FROM users
UNION ALL SELECT 'vessels', count(*) FROM vessels
UNION ALL SELECT 'certificates', count(*) FROM certificates
UNION ALL SELECT 'crew_members', count(*) FROM crew_members
UNION ALL SELECT 'access_logs', count(*) FROM access_logs
ORDER BY 1;

SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN (
  'certificates',
  'crew_members',
  'crew_certificates',
  'crew_certificate_attachments',
  'access_logs'
)
ORDER BY 1;
SQL

log "restore finished"
