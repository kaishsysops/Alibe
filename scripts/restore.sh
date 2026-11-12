#!/usr/bin/env bash
# Restores a database dump made by the backup container, replacing what's there.
#   ./scripts/restore.sh backups/db-20261112-0300.dump
set -euo pipefail
cd "$(dirname "$0")/.."
dump=${1:?Usage: ./scripts/restore.sh backups/db-YYYYMMDD-HHMM.dump}
[ -f "$dump" ] || { echo "No such file: $dump"; exit 1; }
read -r -p "This REPLACES the live database with $dump. Type 'restore' to continue: " ok
[ "$ok" = "restore" ] || { echo "Cancelled."; exit 1; }
docker compose -f docker-compose.prod.yml stop backend
docker exec -i alibe-postgres pg_restore -U alibe -d alibe --clean --if-exists --no-owner < "$dump"
docker compose -f docker-compose.prod.yml start backend
echo "Restored. Photos: tar -xzf backups/files-....tar.gz shows uploads/ and private/ to copy back if needed."
