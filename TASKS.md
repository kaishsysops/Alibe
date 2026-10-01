# Alibe – open tasks

Status as of 2026-10-02. Items are grouped by what's left to do; the scam-prevention list at the bottom is a menu to choose from in the next build.

## Unfinished from this build

### Orders and delivery verification
- [ ] **Order detail screen** (`OrderDetail`). The backend is complete (`/orders/*`); the app only has the Orders list, which opens the order's chat.
  - Seller: pick delivery method, ferry fields (boat name, departure date/time, cargo ref), courier name, pickup note, "Mark as sent", cancel before sending, enter the buyer's 4-digit code to complete delivery.
  - Buyer: show handover code with the warning "Only share this when the item is in your hands", "Send code to seller" for ferry/courier, "Create a new code" after a lockout, "Report a problem", "Rate seller" after delivery.
  - Timeline: ordered → sent → delivered and verified.
- [ ] **Order banner in chat**: show the live order (status + "Open order") at the top of the chat. `/conversations/:id/thread` already returns `order`.
- [ ] **"Sell to this buyer" button** in chat for sellers (`POST /orders`, already built).
- [ ] Point order notifications at `OrderDetail` once it exists (they go to the Orders list for now).

### Features picked but not wired into the app yet (backend done)
- [ ] **Saved searches**: "Save search" button on the Search screen, plus the delivery filter chip (`delivery=PICKUP|FERRY|COURIER`). Saved Searches screen is built but nothing links to it yet.
- [ ] **Recently viewed rail** on Home (`utils/recentlyViewed.ts` records views already).
- [ ] **Bell icon on mobile Home** linking to Notifications (desktop nav bar already has it).
- [ ] **Seller profile**: rating summary, reviews list (`GET /reviews/seller/:id`), delivery count, verified tick, menu with Report/Block.
- [ ] **Profile rows**: Orders, Verified seller progress, Saved searches, Notifications, Blocked users, Appearance.
- [ ] **Dark mode toggle UI**: `useTheme().setMode("system" | "light" | "dark")` exists; add the selector to Edit Profile. The app currently follows the system setting.
- [ ] **Report/Block in chat header menu** (product page has it).

### Push notifications
- [ ] Run `npx eas init` (free Expo account) so the app gets a project id; real lock-screen push then works automatically (token registration + server sending are built).
- [ ] Test on a physical device. Until then, phones get in-app banners and local notifications only while the app is running.

### Verification pass not done
- [ ] Tap through on web + iOS simulator: offers (send/accept/counter/withdraw), photo/video messages, unread badges, chat filters, edit/delete listing, delivery options in the sell flow, share links, block/unblock, light and dark mode on every screen.
- [ ] Re-run the taste-skill checklist on the new screens (copy has no em-dashes, labels above inputs, contrast in dark mode).

### Housekeeping
- [ ] The Expo SDK is 51; the current store version of Expo Go may not open it. Upgrade the SDK before inviting testers.
- [ ] Production deploy: Dockerfile still runs `prisma db push --accept-data-loss` + `tsx watch`; switch to build + `node dist/index.js` and proper migrations. Add Caddy + HTTPS for a VPS.
- [ ] Uploaded files live in the `alibe-uploads` Docker volume on one machine. Move to object storage (e.g. Cloudflare R2) before hosting.
- [ ] Real authentication: the API trusts the user id sent by the app. Add session tokens before any public test.
- [ ] Real SMS OTP (currently always `1234`).

## Scam prevention: options to choose from next build

**Delivery and payment**
1. **Escrow / held payment**: buyer pays into Alibe (BML transfer reference), released to the seller only when the handover code is entered. Strongest protection against "paid but never received".
2. **Payment only after code**: until escrow exists, the app tells buyers never to pay in full before receiving, and shows this in chat when money is mentioned.
3. **Ferry proof**: require a photo of the cargo receipt when marking a ferry order as sent; show it to the buyer.
4. **Delivery deadline**: if an order isn't sent within N days, auto-cancel and flag the seller.

**Chat safety**
5. **Scam phrase detection** in chat: warn on "pay first", "send deposit", gift cards, crypto, links to fake payment pages, requests to move to another app before an order exists.
6. **Link and phone-number warnings**: flag messages with external links or bank account numbers from accounts younger than N days.
7. **Never share your handover code early**: banner whenever a buyer's code is typed into chat before the item is sent.

**Account trust**
8. **New-account limits**: cap listings/messages per day for accounts under 7 days old; slow down bulk messaging.
9. **Phone reputation**: one account per phone number (already enforced); block re-registration of banned numbers.
10. **Trust score on profiles**: verified deliveries, account age, response rate, reviews, reports against them, shown as a simple badge.
11. **Optional ID check** (NID photo reviewed by staff) as a second, stronger tier above delivery verification.

**Listings**
12. **Price anomaly flags**: warn buyers when a price is far below the category's usual range ("too good to be true").
13. **Duplicate/stolen photo detection**: hash uploaded images and flag listings reusing photos from other accounts or the web.
14. **Prohibited items filter** on titles/descriptions (weapons, drugs, counterfeit goods).

**Moderation**
15. **Report review queue**: an admin screen for reports, with auto-hiding of listings that get several reports.
16. **Auto-suspend** accounts with confirmed delivery problems or many reports; block their phone number.
17. **Dispute flow**: when a buyer reports a delivery problem, both sides add evidence (photos, chat) and staff decide.
