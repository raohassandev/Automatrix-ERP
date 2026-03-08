#!/usr/bin/env bash
set -euo pipefail

# Non-destructive by default (dry-run). Set MODE=execute to run.
# Intended for staging-like rollback rehearsal.

MODE="${MODE:-dry-run}" # dry-run | execute
SSH_TARGET="${SSH_TARGET:-hostinger-vps}"
APP_DIR="${APP_DIR:-/var/www/automatrix-erp-staging}"
APP_NAME="${APP_NAME:-automatrix-erp-staging}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3031/api/health}"
LOG_DIR="${LOG_DIR:-docs}"
TS="$(date -u +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR}/ROLLBACK_DRILL_LOG_${TS}.txt"

mkdir -p "$LOG_DIR"

echo "Rollback drill mode: ${MODE}" | tee "$LOG_FILE"
echo "Target: ${SSH_TARGET}" | tee -a "$LOG_FILE"
echo "App: ${APP_NAME} @ ${APP_DIR}" | tee -a "$LOG_FILE"
echo "Health: ${HEALTH_URL}" | tee -a "$LOG_FILE"

read -r -d '' REMOTE_SCRIPT <<'EOS' || true
set -euo pipefail

MODE="${MODE}"
APP_DIR="${APP_DIR}"
APP_NAME="${APP_NAME}"
HEALTH_URL="${HEALTH_URL}"

cd "${APP_DIR}"
git fetch --all --prune

START_COMMIT="$(git rev-parse HEAD)"
TARGET_COMMIT="$(git rev-parse HEAD~1)"
ROLLED_BACK="0"

echo "START_COMMIT=${START_COMMIT}"
echo "TARGET_COMMIT=${TARGET_COMMIT}"

health_check() {
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
      curl -fsS "${HEALTH_URL}"
      return 0
    fi
    sleep 2
  done
  return 1
}

restore_start() {
  if [ "${ROLLED_BACK}" != "1" ]; then
    return 0
  fi
  echo "=== AUTO-RESTORE START COMMIT (FAILSAFE) ==="
  git reset --hard "${START_COMMIT}"
  pnpm install --frozen-lockfile
  pnpm prisma:generate
  pnpm build
  pm2 restart "${APP_NAME}" --update-env || pm2 start ecosystem.staging.js
  health_check
  ROLLED_BACK="0"
}

trap 'if [ "${MODE}" = "execute" ]; then restore_start; fi' ERR

echo "=== PRECHECK ==="
git log -1 --oneline
pm2 status "${APP_NAME}" --no-color || true
health_check

if [ "${MODE}" != "execute" ]; then
  echo "DRY_RUN: would execute rollback to ${TARGET_COMMIT} and return to ${START_COMMIT}"
  exit 0
fi

echo "=== ROLLBACK TO TARGET ==="
git reset --hard "${TARGET_COMMIT}"
ROLLED_BACK="1"
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm build
pm2 restart "${APP_NAME}" --update-env || pm2 start ecosystem.staging.js
health_check

echo "=== ROLL-FORWARD BACK TO START ==="
git reset --hard "${START_COMMIT}"
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm build
pm2 restart "${APP_NAME}" --update-env || pm2 start ecosystem.staging.js
health_check
ROLLED_BACK="0"

echo "DRILL_COMPLETE rollback+roll-forward successful"
EOS

ssh "${SSH_TARGET}" \
  "MODE='${MODE}' APP_DIR='${APP_DIR}' APP_NAME='${APP_NAME}' HEALTH_URL='${HEALTH_URL}' bash -s" \
  <<<"${REMOTE_SCRIPT}" | tee -a "$LOG_FILE"

echo "Log written to ${LOG_FILE}"
