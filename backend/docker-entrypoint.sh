#!/bin/sh
# Brings the database up to date, then starts whatever CMD says.
set -e

# Databases made before migrations existed (with `prisma db push`) get caught up
# to the schema without losing data, then marked as being at the first migration.
state=$(node scripts/db-state.mjs)
if [ "$state" = "legacy" ]; then
  echo "Existing database without migration history: catching up and marking baseline."
  npx prisma db push --skip-generate
  npx prisma migrate resolve --applied 0_init
fi
npx prisma migrate deploy

# Categories and atolls always; demo users and listings unless SEED_DEMO=false.
npx tsx prisma/seed.ts

exec "$@"
