#!/usr/bin/env bash
# Deploys the latest code from GitHub on the VPS (production stack). Run from anywhere:
#   ./deploy.sh
# Safe to run repeatedly: it only rebuilds what changed and keeps the database.
set -euo pipefail

cd "$(dirname "$0")"
LOG_DIR=$(mktemp -d)
trap 'rm -rf "$LOG_DIR"; [ -t 1 ] && tput cnorm 2>/dev/null; true' EXIT

# ---------- looks ----------------------------------------------------------
# Colours and animation only when this is a real terminal (not a pipe or cron).
if [ -t 1 ]; then
  FANCY=1
  R=$'\033[0m' B=$'\033[1m' DIM=$'\033[2m'
  ORANGE=$'\033[38;5;208m' GREEN=$'\033[38;5;42m' RED=$'\033[38;5;203m' GREY=$'\033[38;5;245m' CYAN=$'\033[38;5;80m'
else
  FANCY=0 R= B= DIM= ORANGE= GREEN= RED= GREY= CYAN=
fi

banner() {
  local art=(
    "   █████╗ ██╗     ██╗██████╗ ███████╗"
    "  ██╔══██╗██║     ██║██╔══██╗██╔════╝"
    "  ███████║██║     ██║██████╔╝█████╗  "
    "  ██╔══██║██║     ██║██╔══██╗██╔══╝  "
    "  ██║  ██║███████╗██║██████╔╝███████╗"
    "  ╚═╝  ╚═╝╚══════╝╚═╝╚═════╝ ╚══════╝"
  )
  local shades=(196 202 208 214 220 226)
  echo
  for i in "${!art[@]}"; do
    if [ "$FANCY" = 1 ]; then
      printf '\033[38;5;%sm%s%s\n' "${shades[$i]}" "${art[$i]}" "$R"
      sleep 0.06
    else
      echo "${art[$i]}"
    fi
  done
  local tagline="  marketplace for the Maldives  ·  deploy"
  if [ "$FANCY" = 1 ]; then
    printf '%s' "$GREY"
    for ((c = 0; c < ${#tagline}; c++)); do printf '%s' "${tagline:$c:1}"; sleep 0.012; done
    printf '%s\n\n' "$R"
  else
    printf '%s\n\n' "$tagline"
  fi
}

# Runs a command with a spinner and a timer; output goes to a log that is
# shown only if the step fails.   step "Label" command args...
STEP=0
step() {
  local label=$1; shift
  STEP=$((STEP + 1))
  local log="$LOG_DIR/step$STEP.log" start=$SECONDS
  if [ "$FANCY" = 0 ]; then
    echo "==> $label"
    "$@" >"$log" 2>&1 || { cat "$log"; fail "$label failed"; }
    return
  fi
  "$@" >"$log" 2>&1 &
  local pid=$! frames=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏) i=0
  tput civis 2>/dev/null || true
  while kill -0 "$pid" 2>/dev/null; do
    printf '\r  %s%s%s %s %s%ds%s ' "$ORANGE" "${frames[i++ % 10]}" "$R" "$label" "$GREY" $((SECONDS - start)) "$R"
    sleep 0.08
  done
  tput cnorm 2>/dev/null || true
  if wait "$pid"; then
    printf '\r\033[K  %s✔%s %s %s%ds%s\n' "$GREEN" "$R" "$label" "$GREY" $((SECONDS - start)) "$R"
  else
    printf '\r\033[K  %s✘%s %s\n\n' "$RED" "$R" "$label"
    tail -n 30 "$log" | sed "s/^/    ${DIM}│${R} /"
    fail "$label failed (last 30 lines above)."
  fi
}

info() { printf '    %s%s%s\n' "$GREY" "$*" "$R"; }
fail() { printf '\n  %s%s%s\n\n' "$RED$B" "$*" "$R" >&2; exit 1; }

# Polls a URL until it answers, for up to 3 minutes.
wait_for() { for _ in $(seq 1 60); do curl -fsS --max-time 3 -o /dev/null "$1" 2>/dev/null && return 0; sleep 3; done; return 1; }

# Waits until a container's healthcheck reports healthy, for up to 2 minutes.
wait_healthy() { for _ in $(seq 1 40); do [ "$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null)" = healthy ] && return 0; sleep 3; done; return 1; }

# ---------- deploy ---------------------------------------------------------
# Runs the production stack in docker-compose.prod.yml. To try this script
# without git: ALIBE_SKIP_PULL=1 ./deploy.sh
C="docker compose -f docker-compose.prod.yml"
# Without this, newer Docker stamps every build with a fresh attestation, so
# unchanged images get new IDs and their containers restart for nothing.
export BUILDX_NO_DEFAULT_ATTESTATIONS=1
banner
command -v docker >/dev/null || fail "Docker isn't installed. Run: curl -fsSL https://get.docker.com | sh"

if [ "${ALIBE_SKIP_PULL:-}" != 1 ]; then
  before=$(git rev-parse HEAD)
  # Not behind a spinner: git may need to ask for a password or key passphrase.
  printf '  %s↓%s Pulling the latest code\n' "$ORANGE" "$R"
  git pull --ff-only -q || fail "git pull failed. If you edited files on the server, run 'git status' to see them."
  after=$(git rev-parse HEAD)
  if [ "$before" = "$after" ]; then
    info "Already up to date: $(git log --oneline -1)"
  else
    git log --oneline "$before..$after" | while read -r line; do info "+ $line"; done
    # This script may itself have just changed: carry on with the new version.
    if git diff --name-only "$before" "$after" | grep -qx deploy.sh; then
      info "deploy.sh was updated, continuing with the new version"
      ALIBE_SKIP_PULL=1 exec "./deploy.sh" "$@"
    fi
  fi
fi

# ---- settings in .env: created on the first run, kept after that ----
touch .env
env_get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true; }
env_set() { { grep -vE "^$1=" .env || true; echo "$1=$2"; } > .env.tmp && mv .env.tmp .env; }

# The app needs the server's public IPv4 address to build its links.
current_ip=$(env_get LAN_IP)
if [ -z "$current_ip" ] || [[ "$current_ip" == *:* ]]; then
  ip=$(curl -4fsS --max-time 10 ifconfig.me || true)
  [ -n "$ip" ] || ip=$(ip -4 addr show scope global | awk '/inet /{sub(/\/.*/,"",$2); print $2; exit}')
  [ -n "$ip" ] || fail "Couldn't find this server's IPv4 address. Put it in .env as LAN_IP=1.2.3.4"
  env_set LAN_IP "$ip"
  info "Set LAN_IP=$ip"
fi
ip=$(env_get LAN_IP)

# A strong database password replaces the old default 'alibe'.
if [ -z "$(env_get POSTGRES_PASSWORD)" ]; then
  env_set POSTGRES_PASSWORD "$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  info "Generated a strong database password (kept in .env)"
fi

# Signs staff links to payment slips; shared by every API replica.
if [ -z "$(env_get SLIP_LINK_SECRET)" ]; then
  env_set SLIP_LINK_SECRET "$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
fi

# With no SMS/email provider, codes must show in the app or nobody can sign in.
if [ -z "$(env_get SHOW_CODES_IN_APP)" ]; then
  env_set SHOW_CODES_IN_APP true
  info "SHOW_CODES_IN_APP=true until SMS/email sending is set up"
fi
chmod 600 .env

# HTTPS through Caddy, only when DOMAINS is set in .env, e.g.
#   DOMAINS=alibe.online, www.alibe.online, beta.alibe.online
domains=$(env_get DOMAINS)
if [ -n "$domains" ]; then
  export COMPOSE_PROFILES=https
  # Never fight another web server for 80/443: if something other than
  # Alibe's own Caddy holds them, stop and say what.
  holders=$(sudo -n ss -tlnpH '( sport = :80 or sport = :443 )' 2>/dev/null || ss -tlnH '( sport = :80 or sport = :443 )' 2>/dev/null || true)
  if [ -n "$holders" ] && ! docker ps --format '{{.Names}}' | grep -qx alibe-caddy; then
    printf '%s\n' "$holders" | sed 's/^/    /'
    fail "Ports 80/443 are already in use (above), so Caddy can't start. Nothing was changed. Free them, or remove DOMAINS from .env."
  fi
fi
mkdir -p backups

start_db() { $C up -d postgres && wait_healthy alibe-postgres; }
# Databases made before this used the password 'alibe'. Setting it on every run
# keeps the database and .env in step. Uses the local socket, so no password needed.
set_db_password() { docker exec alibe-postgres psql -q -U alibe -d alibe -c "ALTER USER alibe PASSWORD '$(env_get POSTGRES_PASSWORD)'"; }

step "Starting the database" start_db
step "Securing the database password" set_db_password
# The old version keeps serving while everything builds.
step "Building images (the web app takes a few minutes)" $C build

# Database changes first, while the old API keeps serving. (Migrations should
# only add things, so the old code still works against the new schema.)
step "Updating the database" $C run --rm -T migrate

# Rolling restart: start the new API replicas next to the old ones, wait until
# every new one is healthy, give nginx a moment to find them, then retire the
# old ones. Visitors are always served by one version or the other.
replicas=$(env_get BACKEND_REPLICAS); replicas=${replicas:-2}
old_api=$($C ps -q backend 2>/dev/null || true)
old_count=$(printf '%s' "$old_api" | grep -c . || true)
start_new_api() {
  $C up -d --no-deps --no-recreate --scale backend=$((replicas + old_count)) backend || return 1
  for _ in $(seq 1 60); do
    local ready=1 id
    for id in $($C ps -q backend); do
      printf '%s' "$old_api" | grep -q "$id" && continue
      [ "$(docker inspect -f '{{.State.Health.Status}}' "$id")" = healthy ] || ready=0
    done
    [ "$ready" = 1 ] && return 0
    sleep 3
  done
  return 1
}
retire_old_api() {
  [ -n "$old_api" ] || return 0
  sleep 7  # nginx re-reads the replica list every 5 seconds
  # shellcheck disable=SC2086
  docker stop -t 10 $old_api >/dev/null && docker rm $old_api >/dev/null
}
step "Starting $replicas new API replicas next to the old ones" start_new_api
step "Retiring the old API replicas" retire_old_api
# The old dev-server container (pre-production setup) holds port 8081: clear it first.
swap_web() { docker rm -f alibe-mobile >/dev/null 2>&1 || true; $C up -d --no-deps --remove-orphans web backup; }
# Caddy keeps running across deploys; a reload picks up Caddyfile changes
# without dropping connections or certificates.
start_https() { $C up -d --no-deps caddy && sleep 2 && docker exec alibe-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; }
step "Switching to the new web app" swap_web
step "Checking the app reaches the API" wait_for http://localhost:8081/api/health
[ -n "$domains" ] && step "Starting HTTPS (Caddy) for $domains" start_https

# ---------- summary --------------------------------------------------------
echo
$C ps --format '{{.Name}}\t{{.Status}}' | while IFS=$'\t' read -r name status; do
  printf '  %s●%s %-16s %s%s%s\n' "$GREEN" "$R" "$name" "$GREY" "$status" "$R"
done
dumps=$(find backups -name 'db-*.dump' 2>/dev/null | wc -l | tr -d ' ')
cat <<EOF

  ${ORANGE}${B}╭────────────────────────────────────────────${R}
  ${ORANGE}${B}│${R}  ${GREEN}${B}Alibe is live${R}  ${GREY}($(git rev-parse --short HEAD 2>/dev/null || echo local))${R}
  ${ORANGE}${B}│${R}
$(if [ -n "$domains" ]; then for d in ${domains//,/ }; do printf '  %s│%s  App      %shttps://%s%s\n' "${ORANGE}${B}" "$R" "$CYAN" "$d" "$R"; done; fi)
  ${ORANGE}${B}│${R}  Direct   ${CYAN}http://$ip:8081${R}
  ${ORANGE}${B}│${R}  Health   ${CYAN}http://$ip:8081/api/health${R}
  ${ORANGE}${B}│${R}  API      ${GREY}$replicas replicas, load balanced (BACKEND_REPLICAS in .env)${R}
  ${ORANGE}${B}│${R}  Backups  ${GREY}daily into ./backups ($dumps so far)${R}
  ${ORANGE}${B}│${R}
  ${ORANGE}${B}│${R}  ${GREY}Logs and staff commands: ./scripts/admin.sh${R}
  ${ORANGE}${B}╰────────────────────────────────────────────${R}
EOF
if [ "$(env_get SHOW_CODES_IN_APP)" = true ]; then
  printf '\n  %s%s⚠  Test mode: sign-in codes show in the app, so anyone can sign in as anyone.%s\n' "$ORANGE" "$B" "$R"
  printf '  %s   Set SHOW_CODES_IN_APP=false in .env once SMS/email sending works.%s\n' "$GREY" "$R"
fi
echo
