# HTTPS for deploy.sh (sourced, not run). Alibe is one site in this server's
# own nginx (which also serves other sites): this writes that site, gets a Let's
# Encrypt certificate with certbot (it renews itself), switches the site to
# HTTPS, checks it, and then publishes port 8081 on this machine only.
#
# Once all that is in place, a deploy only checks it from the outside and
# doesn't need sudo at all.
#
# Uses deploy.sh's helpers: step, step_soft, info, fail, env_get, env_set, $C.

https_mode=""   # "ready" (nothing to do) | "nginx" (set up / repair)
https_names=()  # alibe.online www.alibe.online ...
NGINX_SITE_NAME=alibe
CERT_NAME=alibe

# Run once, early, in the foreground (sudo may ask for the password).
https_prepare() {
  local domains
  domains=$(env_get DOMAINS)
  read -r -a https_names <<<"${domains//,/ }"

  # Already set up? The site file matches, HTTPS answers and 8081 is local only.
  local site
  site=$(nginx_site_path)
  if [ -r "$site" ] && cmp -s <(nginx_render 1) "$site" && [ "$(env_get WEB_PUBLISH)" = "127.0.0.1:8081:80" ] && nginx_check_https quick; then
    https_mode=ready
    info "HTTPS: in place for ${https_names[*]}"
    return 0
  fi

  printf '  %s🔒%s Setting up HTTPS for %s needs admin rights on this server.\n' "$ORANGE" "$R" "${https_names[*]}"
  sudo -v || fail "HTTPS needs sudo. Run ./deploy.sh again."
  if ! command -v nginx >/dev/null; then
    sudo -n apt-get update -qq && sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx || fail "Couldn't install nginx."
  fi
  local holders
  holders=$(sudo -n ss -tlnpH '( sport = :80 or sport = :443 )' 2>/dev/null || true)
  if [ -n "$holders" ] && ! printf '%s' "$holders" | grep -q '"nginx"'; then
    printf '%s\n' "$holders" | sed 's/^/    /'
    fail "Ports 80/443 are held by something other than nginx (above). Nothing was changed."
  fi
  https_mode=nginx
}

# ---- nginx route ---------------------------------------------------------------

nginx_site_path() {
  if [ -d /etc/nginx/sites-available ]; then echo "/etc/nginx/sites-available/$NGINX_SITE_NAME"; else echo "/etc/nginx/conf.d/$NGINX_SITE_NAME.conf"; fi
}

# The whole site, from the domain list. HTTP-only until the certificate exists,
# then HTTP redirects to HTTPS.
nginx_render() {
  local with_ssl=$1 names="${https_names[*]}"
  local proxy='
    client_max_body_size 60m;
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $alibe_client_ip;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }'
  cat <<NGINX
# Alibe. Written by deploy.sh (scripts/https.sh) on every deploy: change the
# script, not this file. The rest of this server's nginx isn't touched.

# The visitor's IP: from Cloudflare when proxied, else the connection's.
map \$http_cf_connecting_ip \$alibe_client_ip {
    ""      \$remote_addr;
    default \$http_cf_connecting_ip;
}

server {
    listen 80;
    listen [::]:80;
    server_name $names;
NGINX
  if [ "$with_ssl" = 1 ]; then
    cat <<NGINX
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $names;
    ssl_certificate /etc/letsencrypt/live/$CERT_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$CERT_NAME/privkey.pem;
NGINX
    [ -f /etc/letsencrypt/options-ssl-nginx.conf ] && echo "    include /etc/letsencrypt/options-ssl-nginx.conf;"
  fi
  printf '%s\n}\n' "$proxy"
}

# Installs the site if it changed. Backs up the old file; if nginx rejects the
# new config, the old one goes back and nothing is reloaded.
nginx_apply() {
  local site new backup
  site=$(nginx_site_path)
  new=$(mktemp)
  nginx_render "$1" >"$new"
  if sudo -n test -f "$site" && sudo -n cmp -s "$new" "$site"; then
    rm -f "$new"
    return 0
  fi
  backup="$site.bak-$(date +%Y%m%d-%H%M%S)"
  sudo -n test -f "$site" && sudo -n cp -a "$site" "$backup"
  sudo -n install -m 644 "$new" "$site"
  rm -f "$new"
  [ -d /etc/nginx/sites-enabled ] && sudo -n ln -sfn "$site" "/etc/nginx/sites-enabled/$NGINX_SITE_NAME"
  if ! sudo -n nginx -t >/dev/null 2>&1; then
    sudo -n nginx -t 2>&1 | tail -5
    if [ -n "${backup:-}" ] && sudo -n test -f "$backup"; then sudo -n cp -a "$backup" "$site"; else sudo -n rm -f "$site" "/etc/nginx/sites-enabled/$NGINX_SITE_NAME"; fi
    echo "nginx rejected the Alibe site; the previous config was put back."
    return 1
  fi
  sudo -n systemctl reload nginx
}

nginx_has_cert() {
  local have
  have=$(sudo -n certbot certificates --cert-name "$CERT_NAME" 2>/dev/null | sed -n 's/^ *Domains: //p')
  [ -n "$have" ] || return 1
  for n in "${https_names[@]}"; do
    printf ' %s ' "$have" | grep -q " $n " || return 1
  done
}

nginx_get_cert() {
  if ! command -v certbot >/dev/null || ! sudo -n test -d /usr/lib/python3/dist-packages/certbot_nginx; then
    command -v apt-get >/dev/null || { echo "certbot isn't installed and this isn't a Debian/Ubuntu server."; return 1; }
    sudo -n apt-get update -qq && sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx || return 1
  fi
  nginx_has_cert && return 0
  local email args=()
  email=$(env_get CERTBOT_EMAIL)
  if [ -n "$email" ]; then args+=(--email "$email"); else args+=(--register-unsafely-without-email); fi
  for n in "${https_names[@]}"; do args+=(-d "$n"); done
  # "certonly": certbot proves ownership through nginx but leaves the site file
  # to us. The deploy hook reloads nginx after every automatic renewal.
  if ! sudo -n certbot certonly --nginx --non-interactive --agree-tos --cert-name "$CERT_NAME" --expand --deploy-hook "systemctl reload nginx" "${args[@]}"; then
    cat <<MSG

Let's Encrypt couldn't verify the domains. With Cloudflare's proxy on (orange
cloud) this usually means Cloudflare intercepted the check. Fix: in Cloudflare
DNS, set alibe.online, www and beta to "DNS only" (grey cloud), run
./deploy.sh again, then turn the orange cloud back on. The site keeps working
over plain HTTP meanwhile.
MSG
    return 1
  fi
}

nginx_check_https() {
  local first=${https_names[0]} tries=10
  [ "${1:-}" = quick ] && tries=1
  for _ in $(seq 1 "$tries"); do
    curl -fsS --max-time 5 --resolve "$first:443:127.0.0.1" "https://$first/api/health" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

# Once HTTPS works, the app is only reachable through nginx: port 8081 is
# published on this machine only.
lock_web_port() {
  [ "$(env_get WEB_PUBLISH)" = "127.0.0.1:8081:80" ] && return 0
  env_set WEB_PUBLISH 127.0.0.1:8081:80
  $C up -d --no-deps web && wait_for http://localhost:8081
}

# ---- run after the app is up -------------------------------------------------

https_apply() {
  case "$https_mode" in
    ready)
      step "Checking https://${https_names[0]}" nginx_check_https
      ;;
    nginx)
      # A long build can outlast sudo's memory: ask again here if needed.
      sudo -n true 2>/dev/null || sudo -v || fail "HTTPS needs sudo."
      step "Adding Alibe to the server's nginx" nginx_apply 0
      if step_soft "Getting the HTTPS certificate (Let's Encrypt)" nginx_get_cert; then
        step "Switching the site to HTTPS" nginx_apply 1
        step "Checking https://${https_names[0]}" nginx_check_https
        step "Closing port 8081 to the internet (nginx serves the app now)" lock_web_port
      fi
      ;;
  esac
}
