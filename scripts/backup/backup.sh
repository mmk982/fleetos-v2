#!/usr/bin/env bash
# FleetOS backup: encrypted pg_dump (custom) + attachments tar.
# Requires: pg_dump, tar, age, sha256sum (or shasum -a 256).
# Secrets via env/files only — do not pass passwords on the CLI.
#
# Required env:
#   DATABASE_MIGRATE_URL  — owner URL (or PG* vars for .pgpass-style use)
#   AGE_RECIPIENT         — age public key (age1…)
# Optional:
#   ATTACHMENTS_DIR       — default /app/data/attachments or ./data/attachments
#   BACKUP_ROOT           — default /var/backups/fleetos
#   BACKUP_RETENTION_DAILY / _WEEKLY / _MONTHLY
#   SKIP_OFFSITE=1        — skip rclone upload section
set -euo pipefail

log() { printf '[backup] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "missing dependency: $1"; }

need pg_dump
need tar
need age
if command -v sha256sum >/dev/null 2>&1; then
  SHA_CMD=(sha256sum)
elif command -v shasum >/dev/null 2>&1; then
  SHA_CMD=(shasum -a 256)
else
  die "missing sha256sum or shasum"
fi

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/fleetos}"
ATTACHMENTS_DIR="${ATTACHMENTS_DIR:-}"
if [[ -z "${ATTACHMENTS_DIR}" ]]; then
  if [[ -d /app/data/attachments ]]; then
    ATTACHMENTS_DIR=/app/data/attachments
  else
    ATTACHMENTS_DIR="$(cd "$(dirname "$0")/../.." && pwd)/data/attachments"
  fi
fi

AGE_RECIPIENT="${AGE_RECIPIENT:-}"
[[ -n "${AGE_RECIPIENT}" ]] || die "AGE_RECIPIENT (age public key) is required"

RETENTION_DAILY="${BACKUP_RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${BACKUP_RETENTION_WEEKLY:-4}"
RETENTION_MONTHLY="${BACKUP_RETENTION_MONTHLY:-6}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/fleetos-backup.XXXXXX")"
trap 'rm -rf "${WORK}"' EXIT

mkdir -p "${BACKUP_ROOT}/daily" "${BACKUP_ROOT}/weekly" "${BACKUP_ROOT}/monthly"

log "dumping database (custom format)…"
# Prefer URL from env; pg_dump reads it without putting the password in argv
# when using connection URI via --dbname (still visible in /proc on some OS —
# prefer ~/.pgpass or connection service file on hardened hosts).
[[ -n "${DATABASE_MIGRATE_URL:-}" ]] || die "DATABASE_MIGRATE_URL is required"
pg_dump --dbname="${DATABASE_MIGRATE_URL}" -Fc -f "${WORK}/db.dump"

log "archiving attachments from ${ATTACHMENTS_DIR}…"
mkdir -p "${ATTACHMENTS_DIR}"
tar -C "$(dirname "${ATTACHMENTS_DIR}")" -cf "${WORK}/attachments.tar" "$(basename "${ATTACHMENTS_DIR}")"

BUNDLE_PLAIN="${WORK}/fleetos-${STAMP}.tar"
tar -C "${WORK}" -cf "${BUNDLE_PLAIN}" db.dump attachments.tar

BUNDLE_ENC="${BACKUP_ROOT}/daily/fleetos-${STAMP}.tar.age"
log "encrypting with age recipient…"
age -r "${AGE_RECIPIENT}" -o "${BUNDLE_ENC}" "${BUNDLE_PLAIN}"

CHECKSUM_FILE="${BUNDLE_ENC}.sha256"
(
  cd "$(dirname "${BUNDLE_ENC}")"
  "${SHA_CMD[@]}" "$(basename "${BUNDLE_ENC}")" > "$(basename "${CHECKSUM_FILE}")"
)

log "wrote ${BUNDLE_ENC}"
log "checksum $(cat "${CHECKSUM_FILE}")"

# Promote copies into weekly/monthly slots (hardlink when possible).
DOW="$(date -u +%u)"   # 1=Mon … 7=Sun
DOM="$(date -u +%d)"
if [[ "${DOW}" == "7" ]]; then
  cp -f "${BUNDLE_ENC}" "${BACKUP_ROOT}/weekly/fleetos-${STAMP}.tar.age"
  cp -f "${CHECKSUM_FILE}" "${BACKUP_ROOT}/weekly/fleetos-${STAMP}.tar.age.sha256"
fi
if [[ "${DOM}" == "01" ]]; then
  cp -f "${BUNDLE_ENC}" "${BACKUP_ROOT}/monthly/fleetos-${STAMP}.tar.age"
  cp -f "${CHECKSUM_FILE}" "${BACKUP_ROOT}/monthly/fleetos-${STAMP}.tar.age.sha256"
fi

prune_dir() {
  local dir="$1" keep="$2"
  local -a files=()
  # Avoid `ls` exit 2 on empty globs under pipefail.
  shopt -s nullglob
  files=("${dir}"/fleetos-*.tar.age)
  shopt -u nullglob
  (( ${#files[@]} <= keep )) && return 0
  # Newest first
  local sorted
  mapfile -t sorted < <(printf '%s\n' "${files[@]}" | sort -r)
  local i
  for ((i = keep; i < ${#sorted[@]}; i++)); do
    log "pruning ${sorted[$i]}"
    rm -f "${sorted[$i]}" "${sorted[$i]}.sha256"
  done
}

prune_dir "${BACKUP_ROOT}/daily" "${RETENTION_DAILY}"
prune_dir "${BACKUP_ROOT}/weekly" "${RETENTION_WEEKLY}"
prune_dir "${BACKUP_ROOT}/monthly" "${RETENTION_MONTHLY}"

if [[ "${SKIP_OFFSITE:-0}" == "1" ]]; then
  log "SKIP_OFFSITE=1 — not uploading"
elif [[ -z "${RCLONE_REMOTE:-}" ]]; then
  log "WARNING: RCLONE_REMOTE unset — offsite upload SKIPPED (loud warning)."
  log "WARNING: backups exist only on this host until rclone is configured."
else
  need rclone
  log "uploading to ${RCLONE_REMOTE}…"
  rclone copy "${BUNDLE_ENC}" "${RCLONE_REMOTE}/daily/"
  rclone copy "${CHECKSUM_FILE}" "${RCLONE_REMOTE}/daily/"
fi

log "done"
echo "${BUNDLE_ENC}"
