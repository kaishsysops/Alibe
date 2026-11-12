#!/bin/sh
# Brings the database up to date, then starts whatever CMD says.
#   `migrate` as the command: only update the database, then exit (the one-off
#   step deploys run before starting API replicas, so they never race).
#   MIGRATE_ON_START=false: skip it (API replicas in production).
set -e

# Local development mounts prisma/ from the host, so the schema can be newer
# than the image: refresh the database client to match (a couple of seconds).
if [ "${NODE_ENV:-}" != "production" ]; then
  npx prisma generate >/dev/null
fi

if [ "$1" = "migrate" ] || [ "${MIGRATE_ON_START:-true}" = "true" ]; then
  # Databases made before migrations existed (with `prisma db push`) get caught
  # up to the schema without losing data, then marked as being at the first migration.
  state=$(node scripts/db-state.mjs)
  if [ "$state" = "legacy" ]; then
    echo "Existing database without migration history: catching up and marking baseline."
    npx prisma db push --skip-generate
    npx prisma migrate resolve --applied 0_init
  fi
  npx prisma migrate deploy
  # Categories and atolls always; demo users and listings unless SEED_DEMO=false.
  npx tsx prisma/seed.ts
fi

[ "$1" = "migrate" ] && exit 0
exec "$@"
