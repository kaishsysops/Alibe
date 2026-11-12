#!/usr/bin/env bash
# Staff and maintenance commands on the VPS. With several API replicas there's
# no single "alibe-backend" container any more; this runs them in one replica.
#
#   ADMIN_PASSWORD='...' ./scripts/admin.sh set-admin kaish
#   STAFF_CODE=12345678  ./scripts/admin.sh set-staff-code
#   ./scripts/admin.sh make-admin you@example.com
#   ./scripts/admin.sh import-ibay [--categories=3]   (runs in the background)
#   ./scripts/admin.sh ibay-log
#   ./scripts/admin.sh psql
#   ./scripts/admin.sh logs
set -euo pipefail
cd "$(dirname "$0")/.."
C="docker compose -f docker-compose.prod.yml"
cmd=${1:-help}; shift || true
run() { $C exec -T -e ADMIN_PASSWORD="${ADMIN_PASSWORD:-}" -e STAFF_CODE="${STAFF_CODE:-}" backend "$@"; }

case "$cmd" in
  set-admin)      run npx tsx prisma/set-admin.ts "$@" ;;
  set-staff-code) run npx tsx prisma/set-staff-code.ts ;;
  make-admin)     run npx tsx prisma/make-admin.ts "$@" ;;
  import-ibay)    $C exec -d backend sh -c "npx tsx prisma/import-ibay.ts $* > /tmp/ibay.log 2>&1"; echo "Started. Progress: ./scripts/admin.sh ibay-log" ;;
  ibay-log)       run tail -5 /tmp/ibay.log ;;
  psql)           $C exec postgres psql -U alibe -d alibe ;;
  logs)           $C logs -f --tail 50 backend ;;
  *)              sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
