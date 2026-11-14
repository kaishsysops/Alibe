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

## Running it on the VPS (production)

One command, run on the VPS in the project folder:

```bash
./deploy.sh
```

It pulls the latest code, checks that sign-in emails can be sent, builds,
updates the database, swaps in the new version without downtime, and makes
sure HTTPS works. The first run asks for the sudo password to set up HTTPS;
after that, deploys don't need it.

| Part | What it is |
|------|------------|
| `alibe-web` | The app (static site, nginx) and the load balancer for the API at `/api` |
| `backend` ×N | API replicas (`BACKEND_REPLICAS`, default 2), compiled TypeScript on Node |
| `migrate` | Runs once per deploy: database migrations, categories and islands |
| `alibe-postgres` | Database (only reachable on the server itself) |
| `alibe-backup` | Daily database dump + photo archive into `./backups` |
| Server nginx | HTTPS for alibe.online, www and beta (Let's Encrypt, renews itself), proxying to the web container on 127.0.0.1:8081 |

**Settings live in `.env`** (created by the first deploy, `chmod 600`, never committed):

| Setting | Meaning |
|---------|---------|
| `RESEND_API_KEY` | Required. Sign-in codes are sent by email; the deploy stops if Resend can't send |
| `MAIL_FROM` | Sender, defaults to `Alibe <no-reply@alibe.online>` (domain verified in Resend) |
| `DOMAINS` | The site's domains; the first is the main address |
| `BACKEND_REPLICAS` | How many API replicas to run (about one per spare CPU core) |
| `CERTBOT_EMAIL` | Optional: certificate expiry notices |
| `POSTGRES_PASSWORD`, `SLIP_LINK_SECRET` | Generated on the first deploy |

**Status:** https://alibe.online/status shows whether the app server,
database and sign-in emails are working, with response times and the running
version (also in Profile > System status).

**Deploys without downtime.** Images build while the old version keeps
serving; migrations run as a one-off step; new API replicas start next to the
old ones and the old ones are retired once the new ones are healthy. If every
replica is down at once, the app shows an "Alibe is updating" screen that
reloads itself.

**Sign-in is email only** for now. Phone sign-in comes back with an SMS
gateway in `backend/src/messaging.ts` and `PHONE_SIGN_IN=true`.

**Database changes use migrations.** After editing `backend/prisma/schema.prisma`:

```bash
docker compose exec backend npx prisma migrate dev --name what-changed
```

then commit the new folder under `backend/prisma/migrations/`. Migrations
should only add things (the old version runs against the new schema for a
moment during a deploy).

**Backups** run daily (database 14 days, photos 3 days) in `./backups`. Copy
them off the server now and then. Restore with
`./scripts/restore.sh backups/db-YYYYMMDD-HHMM.dump`.

**Staff commands** run in one API replica through `./scripts/admin.sh`:

```bash
ADMIN_PASSWORD='...' ./scripts/admin.sh set-admin kaish
STAFF_CODE=12345678  ./scripts/admin.sh set-staff-code
./scripts/admin.sh import-ibay        # then: ./scripts/admin.sh ibay-log
./scripts/admin.sh psql               # database shell
./scripts/admin.sh logs               # API logs
```

Staff sign-in: type the 8-digit staff code into the email field.

## Releasing the phone apps

The app is built in the cloud with Expo's EAS (free tier is enough). Builds talk
to the live server at https://alibe.online/api (set in `mobile/eas.json`).

**One-time setup (needs your accounts):**
1. Expo account (free): `cd mobile && npx eas-cli login`, then `npx eas-cli init`.
   This adds the project id to `app.json`, which also turns on real push
   notifications (lock-screen alerts).
2. Apple Developer Program (USD 99/year) for the App Store, and a Google Play
   developer account (USD 25 once) for Android.
3. Confirm the app id before the first upload; it can never change afterwards.
   It is `com.alibe.app` now (iOS bundle id and Android package).

**Try it on phones first (no store needed):**
- Android: `npx eas-cli build --platform android --profile preview` gives an
  APK link you can install on any Android phone.
- iPhone: `npx eas-cli build --platform ios --profile preview` (register test
  iPhones with `npx eas-cli device:create` first), or use TestFlight below.

**Store builds:**
- `npx eas-cli build --platform all --profile production`
- `npx eas-cli submit --platform ios` (goes to TestFlight, then App Store review)
- `npx eas-cli submit --platform android` (first upload: do it by hand in the
  Play Console, then this command works for later ones)
- Version numbers go up automatically on every production build.

**Store listing needs:** app name and short description, screenshots
(iPhone 6.7" and 6.5", Android phone), privacy policy URL
https://alibe.online/privacy, terms https://alibe.online/terms, a support email
that really exists, the data-safety / privacy questionnaire (answers follow the
privacy policy in `mobile/src/screens/LegalScreen.tsx`), and a demo account for
the reviewers (sign-in is by email code, so give them a test inbox or ask them
to use their own email).

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
