# Alibe — MVP scaffold

A running slice of the Alibe marketplace brief: Postgres + an Express/Prisma API +
an Expo (React Native) app, all containerized and running in OrbStack.

## What's implemented

- Sign in with a phone number or email and a one-time code (email sends through Resend when `RESEND_API_KEY` is set; SMS has no gateway yet; in development the code appears on screen)
- Home feed with category filter chips
- Search with text + atoll filter
- Product detail page
- Sell flow (creates a real listing via the API)
- My Listings
- Profile (static, with sign out)
- Seeded categories, Maldives atolls/islands, and 3 sample listings

Not implemented yet (flagged in-app where relevant): in-app chat, real image
upload (placeholder photos only), payments/checkout, vendor dashboard, push
notifications, favorites.

## Running it

```bash
cd /Users/kaish/Projects/alibe
docker compose up --build
```

This starts three containers in OrbStack:

| Service    | What it is                   | URL                                 |
|------------|-------------------------------|--------------------------------------|
| `postgres` | Database                      | localhost:5432 (user/pass/db: alibe) |
| `backend`  | Express API                   | http://localhost:4000/health         |
| `mobile`   | Expo dev server                | http://localhost:8081                |

First boot takes a minute or two (npm install + prisma db push + seed).
Watch the `backend` logs for `Alibe backend listening on http://0.0.0.0:4000`
and the `mobile` logs for a QR code / "Web is waiting on http://localhost:8081".

## Viewing it

**In your browser (fastest, works immediately):**
Open http://localhost:8081 directly — the mobile container serves the web
build there once Metro logs `Web is waiting on http://localhost:8081`. Open
Chrome DevTools (⌘⌥I) → toggle device toolbar (⌘⇧M) → pick "iPhone 14 Pro" or
similar to view it at a true mobile viewport. Log in with any phone number
or email; in development the code appears on the screen.

**On your actual phone (real mobile view, recommended):**
1. Install the **Expo Go** app from the App Store / Play Store.
2. Make sure your phone is on the same Wi-Fi as this Mac.
3. Run `docker compose logs -f mobile` and scan the QR code it prints with
   your phone's camera (iOS) or the Expo Go app itself (Android).
4. If the QR code doesn't connect, your Mac's LAN IP may have changed —
   update `LAN_IP` in `.env` at the repo root to the output of
   `ipconfig getifaddr en0`, then `docker compose up -d mobile`.

**iOS Simulator:** not available in this setup — it requires the full Xcode
app (not just Command Line Tools), which isn't installed. See the Xcode
install steps below if you want that path too; once installed, run
`cd mobile && npx expo start` from the host (needs Node installed locally)
and press `i`.

**Live editing:** the `mobile/` and `backend/src` folders are bind-mounted
into their containers, so editing files on your Mac triggers Metro Fast
Refresh / backend restart automatically — no rebuild needed for code changes.
A rebuild (`docker compose up -d --build <service>`) is only needed after
changing `package.json` dependencies.

## Running it on the VPS (production stack)

`./deploy.sh` runs `docker-compose.prod.yml`: compiled backend, static web
app behind nginx, database migrations, rate limits and daily backups. Local
development keeps using `docker-compose.yml`.

```bash
# on the VPS, in the project folder: pulls, configures, builds, waits until healthy
./deploy.sh
```

| Container        | What it is                                             | Port              |
|------------------|--------------------------------------------------------|-------------------|
| `alibe-web`      | The app as a static website (nginx), and the API at `/api` | 8081 (public) |
| `alibe-backend`  | API, `NODE_ENV=production`, compiled with `tsc`        | 127.0.0.1:4000    |
| `alibe-postgres` | Database                                               | 127.0.0.1:5432    |
| `alibe-backup`   | Daily `pg_dump` + photo archive into `./backups`       | none              |

Testers open `http://<VPS_IP>:8081`; the app calls the API at
`http://<VPS_IP>:8081/api`. Only port 8081 needs to be open (in the hosting
provider's firewall panel too, if it has one).

**Deploys without downtime for visitors.** Images build while the old version
keeps serving. Then only the API restarts: for those few seconds nginx answers
API calls with `503 {"code":"MAINTENANCE"}` and the app shows an "Alibe is
updating" screen that checks every 4 seconds and reloads itself when the API is
back. The web container only restarts when the app itself changed.

**Settings live in `.env`** (created by the first deploy, `chmod 600`, never committed):

| Setting              | Meaning                                                              |
|----------------------|----------------------------------------------------------------------|
| `LAN_IP`             | The server's public IPv4; the web app is built to call `http://LAN_IP:4000` |
| `POSTGRES_PASSWORD`  | Generated on first deploy. The database password is set to match on every deploy |
| `SHOW_CODES_IN_APP`  | `true` = sign-in codes show in the app (no SMS/email yet). **Anyone can sign in as anyone.** Set to `false` once sending works |
| `SEED_DEMO`          | `false` stops adding the demo users and listings (categories and atolls are always seeded) |
| `RESEND_API_KEY`, `MAIL_FROM` | Email codes through Resend                                  |
| `CORS_ORIGINS`       | Extra websites allowed to call the API (defaults to the web app's own address) |
| `TRUST_PROXY`        | Defaults to `1` (the web container's nginx is in front). Use `2` once host nginx/HTTPS is added in front of that |

Change a setting, then run `./deploy.sh` again.

**Database changes now use migrations.** After editing `backend/prisma/schema.prisma`:

```bash
docker compose exec backend npx prisma migrate dev --name what-changed
```

commit the new folder under `backend/prisma/migrations/`, and the next deploy
applies it. (Databases made before migrations existed are caught up and
marked automatically on their first production start.)

**Backups** run once when the container starts and then every 24 hours:
database dumps kept 14 days, photo archives 3 days, in `./backups` on the VPS.
Copy them off the server now and then. To restore a database dump:

```bash
./scripts/restore.sh backups/db-YYYYMMDD-HHMM.dump
```

**What's still missing for a public launch:** a domain with HTTPS (host nginx +
certbot proxying to port 8081, then bind 8081 to 127.0.0.1), an SMS gateway and/or email
sending (then `SHOW_CODES_IN_APP=false`), and photo storage off the server.

## Useful commands

```bash
# tail logs
docker compose logs -f backend
docker compose logs -f mobile

# restart just the backend after a schema change
docker compose up -d --build backend

# open a psql shell
docker compose exec postgres psql -U alibe -d alibe

# stop everything
docker compose down

# stop and wipe the database
docker compose down -v
```

## Project layout

```
alibe/
├── docker-compose.yml
├── backend/         Express + TypeScript + Prisma API
│   └── prisma/       schema.prisma, seed.ts
└── mobile/           Expo React Native app
    └── src/
        ├── api/       fetch client + auth context
        ├── navigation/
        ├── screens/
        ├── components/
        └── theme/
```

## Installing Xcode (for iOS Simulator)

This Mac currently only has the Xcode Command Line Tools, not the full Xcode
app, so there's no iOS Simulator yet. To get it:

1. **Install from the App Store (simplest):**
   Open the App Store app → search "Xcode" → Get/Install. It's a large
   download (~10-15GB depending on version), so it can take a while on a
   slower connection.
   Or from the terminal: `open "macappstore://apps.apple.com/app/xcode/id497799835"`

2. **Alternative — Apple Developer downloads page** (useful if you want an
   older/specific Xcode version, or the App Store is misbehaving):
   Go to https://developer.apple.com/download/all/, sign in with an Apple ID,
   search "Xcode", download the `.xip` file, then double-click it to expand
   and drag `Xcode.app` into `/Applications`.

3. **After installing, point the command line tools at it and accept the
   license** (run these yourself in a terminal — they need sudo):
   ```bash
   sudo xcode-select -switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```

4. **Install the iOS Simulator runtime:**
   Open Xcode → Settings (⌘,) → Platforms tab → click the `+` next to iOS
   and install a simulator runtime. First-launch of Xcode also usually
   prompts you to install "additional required components" — accept that.

5. **Verify it worked:**
   ```bash
   xcodebuild -version
   xcrun simctl list devices
   ```
   You should see version info and a list of simulator devices (iPhone 15,
   etc.) instead of the "requires Xcode" error from earlier.

6. **Run the Alibe app in the simulator** (needs Node installed on the host —
   `brew install node` if you don't have it):
   ```bash
   cd /Users/kaish/Projects/alibe/mobile
   npm install
   npx expo start
   ```
   Then press `i` to launch it in the iOS Simulator. This runs Metro locally
   on the host rather than in the `mobile` container — you can run either,
   just not both bound to port 8081 at the same time.
