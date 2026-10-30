#!/usr/bin/env bash
# Monthly restore drill: throwaway Postgres → restore latest bundle → sanity → teardown.
# Exit non-zero on checksum/restore/sanity failure.
#
# Required:
#   AGE_IDENTITY          — private key file (NOT stored on the prod server long-term;
#                           for the drill, mount from offline media / operator machine)
#   BACKUP_ROOT           — directory containing daily/*.tar.age
# Optional:
#   VERIFY_POSTGRES_IMAGE — default postgres:17.4
set -euo pipefail

log() { printf '[verify-restore] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "missing dependency: $1"; }
need docker
need age

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/fleetos}"
IMAGE="${VERIFY_POSTGRES_IMAGE:-postgres:17.4}"
[[ -n "${AGE_IDENTITY:-}" && -f "${AGE_IDENTITY}" ]] || die "AGE_IDENTITY file required"

LATEST="$(ls -1t "${BACKUP_ROOT}/daily"/fleetos-*.tar.age 2>/dev/null | head -n1 || true)"
[[ -n "${LATEST}" ]] || die "no daily bundles under ${BACKUP_ROOT}/daily"

NAME="fleetos-restore-drill-$$"
PASS="drill_pass_$$"
PORT=$((55432 + RANDOM % 1000))
ATTACH_TMP="$(mktemp -d "${TMPDIR:-/tmp}/fleetos-attach.XXXXXX")"

cleanup() {
  docker rm -f "${NAME}" >/dev/null 2>&1 || true
  rm -rf "${ATTACH_TMP}"
}
trap cleanup EXIT

log "starting throwaway Postgres ${IMAGE} on localhost:${PORT}…"
docker run -d --name "${NAME}" \
  -e POSTGRES_USER=fleetos \
  -e POSTGRES_PASSWORD="${PASS}" \
  -e POSTGRES_DB=fleetos \
  -p "${PORT}:5432" \
  "${IMAGE}" >/dev/null

for i in $(seq 1 60); do
  if docker exec "${NAME}" pg_isready -U fleetos -d fleetos >/dev/null 2>&1; then
    break
  fi
  sleep 1
  [[ "${i}" -eq 60 ]] && die "Postgres did not become ready"
done

export TARGET_DATABASE_URL="postgres://fleetos:${PASS}@127.0.0.1:${PORT}/fleetos"
export TARGET_ATTACHMENTS_DIR="${ATTACH_TMP}/attachments"
# Ensure restore does not treat this as live
unset DATABASE_MIGRATE_URL || true

log "restoring ${LATEST}…"
"${SCRIPT_DIR}/restore.sh" "${LATEST}"

log "drill OK"
