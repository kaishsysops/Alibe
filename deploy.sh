#!/usr/bin/env bash
# Deploys the latest code from GitHub on the VPS. Run from anywhere:
#   ./deploy.sh
# Safe to run repeatedly: it only rebuilds what changed and keeps the database.
set -euo pipefail

cd "$(dirname "$0")"
LOG_DIR=$(mktemp -d)
trap 'rm -rf "$LOG_DIR"; tput cnorm 2>/dev/null || true' EXIT

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

# ---------- deploy ---------------------------------------------------------
banner
command -v docker >/dev/null || fail "Docker isn't installed. Run: curl -fsSL https://get.docker.com | sh"

before=$(git rev-parse HEAD)
# Not behind a spinner: git may need to ask for a password or key passphrase.
printf '  %s↓%s Pulling the latest code\n' "$ORANGE" "$R"
git pull --ff-only -q || fail "git pull failed. If you edited files on the server, run 'git status' to see them."
after=$(git rev-parse HEAD)
changed=$(git diff --name-only "$before" "$after")
if [ "$before" = "$after" ]; then
  info "Already up to date: $(git log --oneline -1)"
else
  git log --oneline "$before..$after" | while read -r line; do info "+ $line"; done
fi

# The app needs the server's public IPv4 address to build its links.
current_ip=$(grep -E '^LAN_IP=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -z "$current_ip" ] || [[ "$current_ip" == *:* ]]; then
  ip=$(curl -4fsS --max-time 10 ifconfig.me || true)
  [ -n "$ip" ] || ip=$(ip -4 addr show scope global | awk '/inet /{sub(/\/.*/,"",$2); print $2; exit}')
  [ -n "$ip" ] || fail "Couldn't find this server's IPv4 address. Put it in .env as LAN_IP=1.2.3.4"
  touch .env
  { grep -v '^LAN_IP=' .env || true; echo "LAN_IP=$ip"; } > .env.tmp && mv .env.tmp .env
  info "Set LAN_IP=$ip in .env"
fi
ip=$(grep -E '^LAN_IP=' .env | cut -d= -f2-)

# The app's packages live in a Docker volume that a rebuild doesn't refresh,
# so clear it when mobile/package.json changes.
if echo "$changed" | grep -qx 'mobile/package.json'; then
  volume="$(basename "$PWD" | tr '[:upper:]' '[:lower:]')_mobile-node-modules"
  step "Clearing old app packages" sh -c "docker compose rm -sf mobile && (docker volume rm $volume || true)"
fi

step "Building images" docker compose build
step "Starting containers" docker compose up -d --remove-orphans
step "Waiting for the API" wait_for http://localhost:4000/health
step "Waiting for the app server" wait_for http://localhost:8081

# ---------- summary --------------------------------------------------------
echo
docker compose ps --format '{{.Name}}\t{{.Status}}' | while IFS=$'\t' read -r name status; do
  printf '  %s●%s %-16s %s%s%s\n' "$GREEN" "$R" "$name" "$GREY" "$status" "$R"
done
cat <<EOF

  ${ORANGE}${B}╭────────────────────────────────────────────${R}
  ${ORANGE}${B}│${R}  ${GREEN}${B}Alibe is live${R}  ${GREY}($(git rev-parse --short HEAD))${R}
  ${ORANGE}${B}│${R}
  ${ORANGE}${B}│${R}  App   ${CYAN}http://$ip:8081${R}
  ${ORANGE}${B}│${R}  API   ${CYAN}http://$ip:4000/health${R}
  ${ORANGE}${B}│${R}
  ${ORANGE}${B}│${R}  ${GREY}First load after a deploy can take a minute.${R}
  ${ORANGE}${B}│${R}  ${GREY}Logs: docker compose logs -f backend | mobile${R}
  ${ORANGE}${B}╰────────────────────────────────────────────${R}

EOF
