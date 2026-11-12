#!/bin/sh
# Runs inside the `backup` container (docker-compose.prod.yml): once at start,
# then every 24 hours. Database dumps are kept 14 days, photo archives 3 days.
# Restore a dump with:  ./scripts/restore.sh backups/db-YYYYMMDD-HHMM.dump
set -u
KEEP_DB_DAYS=${KEEP_DB_DAYS:-14}
KEEP_FILES_DAYS=${KEEP_FILES_DAYS:-3}
mkdir -p /backups

while true; do
  ts=$(date +%Y%m%d-%H%M)
  if pg_dump -h postgres -U alibe -d alibe -Fc -f "/backups/db-$ts.dump.part"; then
    mv "/backups/db-$ts.dump.part" "/backups/db-$ts.dump"
    echo "$(date) database backup ok: db-$ts.dump"
  else
    rm -f "/backups/db-$ts.dump.part"
    echo "$(date) DATABASE BACKUP FAILED"
  fi
  if tar -czf "/backups/files-$ts.tar.gz.part" -C / uploads private; then
    mv "/backups/files-$ts.tar.gz.part" "/backups/files-$ts.tar.gz"
    echo "$(date) photo backup ok: files-$ts.tar.gz"
  else
    rm -f "/backups/files-$ts.tar.gz.part"
    echo "$(date) PHOTO BACKUP FAILED"
  fi
  find /backups -name 'db-*.dump' -mtime +"$KEEP_DB_DAYS" -delete
  find /backups -name 'files-*.tar.gz' -mtime +"$KEEP_FILES_DAYS" -delete
  sleep 86400
done
