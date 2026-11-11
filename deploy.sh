#!/usr/bin/env bash
# Deploys the latest code from GitHub on the VPS. Run from anywhere:
#   ./deploy.sh
# Safe to run repeatedly: it only rebuilds what changed and keeps the database.
set -euo pipefail

cd "$(dirname "$0")"

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || fail "Docker isn't installed. Run: curl -fsSL https://get.docker.com | sh"

say "Pulling the latest code"
before=$(git rev-parse HEAD)
git pull --ff-only || fail "git pull failed. If you edited files on the server, run 'git status' to see them."
after=$(git rev-parse HEAD)
changed=$(git diff --name-only "$before" "$after")
if [ "$before" = "$after" ]; then
  echo "Already up to date ($(git log --oneline -1))."
else
  git log --oneline "$before..$after"
fi

# The app needs the server's public IPv4 address to build its links.
current_ip=$(grep -E '^LAN_IP=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -z "$current_ip" ] || [[ "$current_ip" == *:* ]]; then
  ip=$(curl -4fsS --max-time 10 ifconfig.me || true)
  [ -n "$ip" ] || ip=$(ip -4 addr show scope global | awk '/inet /{sub(/\/.*/,"",$2); print $2; exit}')
  [ -n "$ip" ] || fail "Couldn't find this server's IPv4 address. Put it in .env as LAN_IP=1.2.3.4"
  touch .env
  grep -v '^LAN_IP=' .env > .env.tmp || true
  echo "LAN_IP=$ip" >> .env.tmp
  mv .env.tmp .env
  echo "Set LAN_IP=$ip in .env"
fi
ip=$(grep -E '^LAN_IP=' .env | cut -d= -f2-)

# The app's packages live in a Docker volume that isn't refreshed by a rebuild,
# so clear it when mobile/package.json changes.
if echo "$changed" | grep -qx 'mobile/package.json'; then
  say "App packages changed: clearing the old ones"
  docker compose stop mobile >/dev/null 2>&1 || true
  docker compose rm -f mobile >/dev/null 2>&1 || true
  docker volume rm "$(basename "$PWD" | tr '[:upper:]' '[:lower:]')_mobile-node-modules" >/dev/null 2>&1 || true
fi

say "Building and starting containers"
docker compose up -d --build --remove-orphans

say "Waiting for the API"
for i in $(seq 1 60); do
  if curl -fsS --max-time 3 http://localhost:4000/health >/dev/null 2>&1; then
    echo "API is up."
    break
  fi
  [ "$i" = 60 ] && fail "API didn't come up after 3 minutes. Check: docker compose logs --tail 50 backend"
  sleep 3
done

say "Waiting for the app server"
for i in $(seq 1 60); do
  if curl -fsS --max-time 3 -o /dev/null http://localhost:8081 2>/dev/null; then
    echo "App server is up."
    break
  fi
  [ "$i" = 60 ] && fail "App server didn't come up after 3 minutes. Check: docker compose logs --tail 50 mobile"
  sleep 3
done

docker compose ps

say "Done"
echo "Browser:  http://$ip:8081   (first load after a deploy can take a minute or two)"
echo "API:      http://$ip:4000/health"
echo "Logs:     docker compose logs -f backend   |   docker compose logs -f mobile"
