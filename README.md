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
| `GOOGLE_CLIENT_ID` | Optional: shows "Continue with Google" on the web (Google Cloud OAuth client id) |
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

**Checks on every push.** GitHub Actions (`.github/workflows/checks.yml`)
type-checks the backend and app, builds the web app, applies all migrations
to an empty database and checks they match `schema.prisma`, and validates the
deploy scripts, compose file and nginx config. Deploy only when it's green.

**Link previews and search engines.** Bots opening `/listing/<id>` (WhatsApp,
Viber, Facebook, X, Google...) get a small page with the title, price, island
and photo (`backend/src/routes/share.ts`); people get the app. `/sitemap.xml`
lists every active listing, `/robots.txt` points to it.

**Installable.** `/manifest.json` and the icons let people "Add to Home
Screen" and open Alibe full screen.

**Protection.** Alibe's HTTPS site in the server's nginx only accepts
Cloudflare (and the server itself), so nobody can skip Cloudflare by using the
IP. Set `CLOUDFLARE_ONLY=false` in `.env` if the DNS records are ever
grey-clouded for long. Every container has a memory cap, so Alibe can't take
the RAM the server's other sites need.

**Sign-in is by emailed code or "Continue with Google"** (web; the phone apps need their own Google client ids later). Phone sign-in comes back with an SMS
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
ADMIN_PASSWORD='...' ./scripts/admin.sh set-admin kaish   # admin login / new password
./scripts/admin.sh import-ibay        # then: ./scripts/admin.sh ibay-log
./scripts/admin.sh psql               # database shell
./scripts/admin.sh logs               # API logs
```


### Admin and staff portal

The same web app answers on two more addresses (add both as DNS A records to
this server, proxied like the others; `./deploy.sh` adds them to `DOMAINS` and
the certificate):

- **admin.alibe.online**: admins. Everything: payments and plan prices, staff
  and roles, categories, iBay, plus every portal queue.
- **portal.alibe.online**: staff with a portal role. Each sees only their part:
  - *Seller approver*: ID checks and store applications (sees ID photos).
  - *Post approver*: posts from sellers who aren't verified.
  - *Moderator*: reports, removing listings (no bans, no money).
  - *Support*: looks up sellers and disputes, changes nothing.

Staff sign in with a **username and password** made for them; there is no
email code or Google on these sites, and a marketplace sign-in never gives
staff access (only sessions from the staff sign-in reach staff APIs, and they
end after a quiet week). Admins create logins in Admin > Staff and roles, set
new passwords there (which signs that person out elsewhere and clears a
lockout) and remove access. Staff change their own password from the sidebar.
Five wrong passwords lock a login for 15 minutes.

The first deploy asks for the first admin's username and password. Later, or
if every admin is locked out: `ADMIN_PASSWORD='...' ./scripts/admin.sh set-admin <username>`.
On a dev machine, open the app with `?site=admin` or `?site=portal`.

### Card payments (BML Connect): not tested yet

`backend/src/bml.ts` takes card payments through Bank of Maldives' merchant
API. It was written from BML's public docs without an API key, so it has
never actually talked to BML. While it's off (no key), buyers only see bank
transfer and Admin > Payments says "Not set up". To try it:

1. Get an API key (and app id, if shown) from BML's merchant portal.
2. In the server's `.env`: `BML_API_KEY=...`, `BML_APP_ID=...`,
   `BML_MODE=sandbox` (test mode first), then `./deploy.sh`.
3. In BML's portal, set the webhook to `https://alibe.online/api/payments/bml/webhook`.
4. Pay a small test boost by card and check it starts. Lines marked
   `CHECK` in `bml.ts` are the ones most likely to need adjusting.
5. When it works, set `BML_MODE=production` and deploy again.

A purchase only starts once the server has asked BML itself and the
transaction is CONFIRMED for the right amount; redirects and webhooks alone
are never trusted.

### Plans, grace period and reminders

Store and Premium plans keep working for 5 days after their end date. Sellers
get a push and an email 3 days before the end, on the day it ends, the day
before the grace period runs out, and when it switches off. Renewing early or
during grace carries on from the old end date. Unpaid purchases get a
reminder after 1 day and after 3 days.

### Sellers

- **Individual** (default) or **Store**, chosen at sign-up or in Profile >
  Seller account. Businesses must register as a store.
- **Posting rules** (`backend/src/sellers.ts`, `backend/src/postRisk.ts`):
  1. Posts go live at once. Staff don't review everything: a post from a
     seller who isn't verified is held for a Post approver only when a risk
     check trips (approvers see the reason):
     - the text reads like a scam: pay up front, gift cards/crypto, links,
       bank account numbers (the same patterns as the chat warnings)
     - the seller has open reports, or had a post turned down in 30 days
     - an account under 3 days old selling electronics, vehicles or property,
       or anything at MVR 10,000+
     - its photos match another seller's listing (checked just after posting)
  2. Editing a live post runs the checks again; an edited turned-down post
     goes back to the queue. Verified sellers and approved stores are never held.
  3. At most 30 new posts a month, unless the seller has Premium or a live
     Store plan (no limit).
  4. Anything that slips through: 3 reports hide a listing until staff look.
- **Verification is optional:** ID card number plus photos of both sides of the
  card (no selfie: Alibe doesn't collect faces). It skips the review, adds the blue tick and
  unlocks boosts and Premium.
- **Stores** send a name, logo, registration number and the owner's ID (both
  sides, no selfie). ID photos are private (signed 10-minute links for approvers) and are
  deleted as soon as a decision is made; only the last 4 characters of the ID
  number are kept.
- **Store or personal:** a seller with an approved store chooses for each
  listing whether it goes under the store (store name, logo, Store badge,
  on the store page) or as themselves (a personal item).
- **Badges:** the blue tick shows whenever the seller's ID is verified, next
  to the Store or Premium badge.
- **Premium** also includes a daily "bump to top" per item, views and saves
  for every listing, and 12 photos per item.
- **Plans** (prices in Admin > Payments): *Store* (store page, Store badge,
  placed above individuals) and *Premium* (free 7-day boosts each month, new
  items featured for a week, gold badge). Monthly or yearly; a store with
  Premium pays both. Paid by bank transfer like boosts.

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
