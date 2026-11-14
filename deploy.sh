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
# step: a failure stops the deploy. step_soft: a failure is shown and the
# deploy carries on (returns 1), for optional extras like HTTPS certificates.
step() { run_step hard "$@"; }
step_soft() { run_step soft "$@"; }
run_step() {
  local mode=$1 label=$2; shift 2
  STEP=$((STEP + 1))
  local log="$LOG_DIR/step$STEP.log" start=$SECONDS
  if [ "$FANCY" = 0 ]; then
    echo "==> $label"
    "$@" >"$log" 2>&1 && return 0
    cat "$log"
    [ "$mode" = soft ] && { echo "  (carrying on without it)"; return 1; }
    fail "$label failed"
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
    [ "$mode" = soft ] && { printf '\n    %sCarrying on without it.%s\n\n' "$GREY" "$R"; return 1; }
    fail "$label failed (last 30 lines above)."
  fi
}

info() { printf '    %s%s%s\n' "$GREY" "$*" "$R"; }
fail() { printf '\n  %s%s%s\n\n' "$RED$B" "$*" "$R" >&2; exit 1; }

# Polls a URL until it answers, for up to 3 minutes.
wait_for() { for _ in $(seq 1 60); do curl -fsS --max-time 3 -o /dev/null "$1" 2>/dev/null && return 0; sleep 3; done; return 1; }

# Waits until a container's healthcheck reports healthy, for up to 2 minutes.
wait_healthy() { for _ in $(seq 1 40); do [ "$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null)" = healthy ] && return 0; sleep 3; done; return 1; }

# shellcheck source=scripts/https.sh
. "$(dirname "$0")/scripts/https.sh"

# ---------- deploy ---------------------------------------------------------
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
    if git diff --name-only "$before" "$after" | grep -qxE 'deploy.sh|scripts/https.sh'; then
      info "deploy.sh was updated, continuing with the new version"
      ALIBE_SKIP_PULL=1 exec "./deploy.sh" "$@"
    fi
  fi
fi

# ---- settings in .env: created on the first run, kept after that ----
touch .env
env_get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true; }
env_set() { { grep -vE "^$1=" .env || true; echo "$1=$2"; } > .env.tmp && mv .env.tmp .env; }
env_del() { { grep -vE "^$1=" .env || true; } > .env.tmp && mv .env.tmp .env; }

# Settings from earlier versions that no longer exist (test mode, demo data,
# the server's IP): removed so .env only holds what's used.
for old in SHOW_CODES_IN_APP SEED_DEMO RATE_LIMITS LAN_IP; do env_del "$old"; done

[ -n "$(env_get DOMAINS)" ] || env_set DOMAINS "alibe.online, www.alibe.online, beta.alibe.online"
domains=$(env_get DOMAINS)
first_domain=$(printf '%s' "$domains" | cut -d, -f1 | tr -d ' ')
env_set PUBLIC_URL "https://$first_domain"

if [ -z "$(env_get POSTGRES_PASSWORD)" ]; then
  env_set POSTGRES_PASSWORD "$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  info "Generated a strong database password (kept in .env)"
fi
# Signs staff links to payment slips; shared by every API replica.
[ -n "$(env_get SLIP_LINK_SECRET)" ] || env_set SLIP_LINK_SECRET "$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
[ -n "$(env_get MAIL_FROM)" ] || env_set MAIL_FROM "Alibe <no-reply@$first_domain>"
# The first staff account: that email gets staff access when it signs in. More
# staff are added in the app (Profile > Staff).
if [ -z "$(env_get STAFF_EMAILS)" ] && [ -t 0 ]; then
  printf '  %s👤%s Email for the first staff account (Enter to skip): ' "$ORANGE" "$R"
  read -r staff_email || staff_email=""
  if [ -n "$staff_email" ]; then
    env_set STAFF_EMAILS "$staff_email"
    info "Staff: $staff_email (sign in with it to get staff access)"
  fi
fi
chmod 600 .env

# ---- sign-in emails ----
# Sign-in codes are only ever sent by email. If Resend can't send them, nobody
# could sign in, so the deploy stops here, before anything has changed.
resend_check() {
  # Prints: ok | restricted | invalid | unverified | offline
  local key=$1 domain=$2 body
  body=$(curl -sS --max-time 15 -H "Authorization: Bearer $key" https://api.resend.com/domains 2>/dev/null) || { echo offline; return; }
  printf '%s' "$body" | python3 -c '
import sys, json
domain = sys.argv[1]
try:
    d = json.load(sys.stdin)
except Exception:
    print("offline"); sys.exit()
if d.get("name") == "restricted_api_key":
    print("restricted"); sys.exit()
if "data" not in d:
    print("invalid"); sys.exit()
ok = any(x.get("name") == domain and x.get("status") == "verified" for x in d["data"])
print("ok" if ok else "unverified")
' "$domain" 2>/dev/null || echo offline
}
resend_key=$(env_get RESEND_API_KEY)
mail_domain=$(env_get MAIL_FROM | sed -E 's/.*@([^>]+)>?.*/\1/' | tr -d ' ')
[ -n "$resend_key" ] || fail "RESEND_API_KEY is missing from .env. Sign-in codes are sent by email, so it's needed. Nothing was changed."
case "$(resend_check "$resend_key" "$mail_domain")" in
  ok) info "Sign-in emails: Resend, from $mail_domain" ;;
  restricted) info "Sign-in emails: Resend, from $mail_domain (send-only key, so the domain couldn't be double-checked)" ;;
  invalid) fail "Resend rejected RESEND_API_KEY. Check the key in .env. Nothing was changed." ;;
  unverified) fail "$mail_domain isn't verified in Resend (Resend > Domains). Nothing was changed." ;;
  *) info "Couldn't reach Resend to double-check the key; carrying on." ;;
esac

https_prepare

# The commit being deployed, shown on the status page.
APP_VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
export APP_VERSION
mkdir -p backups

start_db() { $C up -d postgres && wait_healthy alibe-postgres; }
# Keeps the database password in step with .env (local socket, no password needed).
set_db_password() { docker exec alibe-postgres psql -q -U alibe -d alibe -c "ALTER USER alibe PASSWORD '$(env_get POSTGRES_PASSWORD)'"; }

step "Starting the database" start_db
step "Securing the database password" set_db_password
# The old version keeps serving while everything builds.
step "Building images" $C build

# Database changes first, while the old API keeps serving. (Migrations should
# only add things, so the old code still works against the new schema.)
step "Updating the database" $C run --rm -T migrate

# Once per server: clear out the demo accounts earlier versions seeded.
if [ "$(env_get DEMO_REMOVED)" != 1 ]; then
  remove_demo() { $C run --rm -T --no-deps --entrypoint npx migrate tsx prisma/remove-demo.ts | tee "$LOG_DIR/demo.txt"; }
  step "Removing old demo data" remove_demo && env_set DEMO_REMOVED 1
  grep -v '^$' "$LOG_DIR/demo.txt" 2>/dev/null | grep -v "No demo data left" | while read -r line; do info "$line"; done
fi

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
step "Switching to the new web app" $C up -d --no-deps --remove-orphans web backup
step "Checking the app reaches the API" wait_for http://localhost:8081/api/health
https_apply

# ---------- summary --------------------------------------------------------
echo
$C ps --format '{{.Name}}\t{{.Status}}' | while IFS=$'\t' read -r name status; do
  printf '  %s●%s %-26s %s%s%s\n' "$GREEN" "$R" "$name" "$GREY" "$status" "$R"
done
dumps=$(find backups -name 'db-*.dump' 2>/dev/null | wc -l | tr -d ' ')
cat <<EOF

  ${ORANGE}${B}╭────────────────────────────────────────────${R}
  ${ORANGE}${B}│${R}  ${GREEN}${B}Alibe is live${R}  ${GREY}($APP_VERSION)${R}
  ${ORANGE}${B}│${R}
$(for d in ${domains//,/ }; do printf '  %s│%s  App      %shttps://%s%s\n' "${ORANGE}${B}" "$R" "$CYAN" "$d" "$R"; done)
  ${ORANGE}${B}│${R}  Status   ${CYAN}https://$first_domain/status${R}
  ${ORANGE}${B}│${R}  API      ${GREY}$replicas replicas, load balanced${R}
  ${ORANGE}${B}│${R}  Backups  ${GREY}daily into ./backups ($dumps so far)${R}
  ${ORANGE}${B}│${R}
  ${ORANGE}${B}│${R}  ${GREY}Logs and staff commands: ./scripts/admin.sh${R}
  ${ORANGE}${B}╰────────────────────────────────────────────${R}

EOF
