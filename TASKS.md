# Alibe – open tasks

Status as of 2026-11-02. Cut down to what matters before launch; everything else is under "Parked".

## Done since 2026-10-02
Order detail screen, order banner in chat, "Sell to this buyer", order notifications open the order, saved searches, recently viewed, bell on Home, seller reviews, profile rows, dark mode toggle, Report/Block in chat, session auth. Expo SDK 58 upgrade + animated tab bar, merged to main.

Built 2026-11-02: email sign-in, real one-time codes, new onboarding, report queue with auto-hide and bans, verified phone before selling, new-account limits, prohibited items filter, price drop alerts, photo zoom, private iBay catalogue. Scam phrase/link/bank/handover-code warnings and trust levels were already in place.

### Push notifications
- [ ] Push no longer works in Expo Go (SDK 53+): needs a development build. Run `npx eas init` (free Expo account) so the app gets a project id; real lock-screen push then works automatically (token registration + server sending are built).
- [ ] Test on a physical device. Until then, phones get in-app banners and local notifications only while the app is running.

### Verification pass not done
- [ ] Tap through on web + iOS simulator: offers (send/accept/counter/withdraw), photo/video messages, unread badges, chat filters, edit/delete listing, delivery options in the sell flow, share links, block/unblock, light and dark mode on every screen.
- [ ] Re-run the taste-skill checklist on the new screens (copy has no em-dashes, labels above inputs, contrast in dark mode).

### Housekeeping
- [x] Production stack (2026-11-12): `docker-compose.prod.yml` + `./deploy.sh`. Compiled backend, Prisma migrations, static web app on nginx, generated DB password, CORS, daily backups, rate limits, photo compression, private payment slips. See README.
- [x] Domain + HTTPS (alibe.online, www, beta): automatic in `./deploy.sh` (adds an nginx site + certbot on this VPS, or Caddy if 80/443 are free). Run it once on the VPS; grey-cloud in Cloudflare only if the certificate step says so.
- [ ] Turn off `SHOW_CODES_IN_APP` in the VPS `.env` once SMS or email sending works. Until then anyone can sign in as anyone.
- [ ] Uploaded files live in the `alibe-uploads` Docker volume on one machine. Move to object storage (e.g. Cloudflare R2) before hosting.
- [ ] SMS gateway (Dhiraagu/Ooredoo aggregator) in `backend/src/messaging.ts`. Codes are real now, but in production phone sign-in refuses to send until this exists.
- [ ] Email sending: set `RESEND_API_KEY` and verify the `MAIL_FROM` domain. Never exercised against the real service yet.
- [x] Per-IP limits (`backend/src/rateLimit.ts`): 10 code requests / 15 min, uploads, new listings, all writes. Set `TRUST_PROXY=1` once behind nginx.
- [ ] Copy `./backups` off the VPS regularly (another machine or object storage).

- [x] Demo/test data (2026-11-14): `./deploy.sh` sets SEED_DEMO=false and removes the seeded demo accounts and their listings/orders/reviews (`prisma/remove-demo.ts`, by their known phone numbers), plus sign-ups that never got past the code step. Local dev no longer seeds demo data either (SEED_DEMO=true brings it back).

## Launch blockers
- [ ] SMS gateway, email provider, hosting and photo storage (see Housekeeping). Nobody outside the network can use the app without them.
- [x] Second, empty accounts (2026-11-14): a code for an unknown phone/email no longer creates an account. The app asks "new, or used Alibe before?" and links the new contact to the existing account.

## Staff accounts
- [ ] Change the `kaish` password before hosting anywhere public: `ADMIN_PASSWORD='...' ./scripts/admin.sh set-admin kaish`

- Staff sign-in opens by typing the secret number into the phone field. Change it with `STAFF_CODE=<8 digits> ./scripts/admin.sh set-staff-code`

## iBay catalogue
- [ ] Get iBay's agreement or legal advice before hosting the public showcase. Only the robots.txt rules were followed so far. Admin > iBay items has the on/off switch; a new database starts with it off.
- Category mapping lives in `backend/src/ibayCategories.ts`. iBay's Wanted and Announcements sections are never shown. Location and delivery filters can't apply: iBay's cards don't give them.
- Home and Search mix iBay items with Alibe's own (`mix=1` on `/listings`), always badged "On iBay". Taking turns for newest; merged by price for price sorts.
- iBay items show Alibe's price everywhere: seller's price plus 15% (`backend/src/money.ts`, changeable in Payments and prices). The seller's price and the margin only reach staff screens, and the price is labelled as Alibe's.
- Money: boosts, ads and buy-for-you are paid by bank transfer plus slip, approved in Profile > Payments and prices. Nothing is live until staff approve.
- [ ] Enter real bank details and prices in the admin screen. Prices are placeholders; payments stay off until the bank details are in.
- [ ] Before taking real money: business registration, tax and advice on reselling. Add a card/BML gateway later if volume justifies it.
- [x] Payment slips move to private storage on submit; staff open them via signed links that expire in an hour.
- [ ] Item pages are read live from iBay the first time someone opens them (cached 6 hours). Watch this once there's real traffic.
- [x] Phone numbers in iBay titles are stripped, including +960 / 960 prefixes.
- Refresh: `./scripts/admin.sh import-ibay` (progress: `./scripts/admin.sh ibay-log`)

## Next if real users ask for it
- [x] Ferry proof: a cargo receipt photo is required to mark a ferry order as sent; the buyer sees it on the order.
- [x] Buyers see "Never pay in full before you have the item" in each chat until they close it.
- [x] Dispute flow: buyer and seller add evidence (text + photo) on the order; staff settle it in Profile > Disputes (sale stands / refund buyer).
- [x] Duplicate/stolen photos: every listing photo is fingerprinted (dHash); a near match with another seller's photo files a report to staff.

## Parked (decided 2026-11-02: not needed before there are real users)
Alibe Pay and escrow (licensing, holding other people's money), Stories, atoll map, bundles, seller dashboard, offer from card, confetti and other delight effects, morphing icons, parallax, collapsing headers, optional ID check, price anomaly flags, delivery deadlines, simulator tap control.
