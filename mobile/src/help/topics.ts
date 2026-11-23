import { MessagesSquare, Compass, ShoppingBag, Tag, ShieldCheck, Package, Rocket, Crown, BadgeCheck, UserCog, LifeBuoy, LucideIcon } from "lucide-react-native";

// Everything in the help centre (Profile > Help, /help). Plain words, short
// answers. Keep the selling rules in step with backend/src/sellers.ts and
// backend/src/postRisk.ts, and prices with Admin > Payments.
export type HelpTopicKey = "faq" | "start" | "buying" | "selling" | "safety" | "orders" | "boosts" | "premium" | "verify" | "account" | "contact";
export type HelpTopic = { key: HelpTopicKey; title: string; blurb: string; Icon: LucideIcon; items: Array<{ q: string; a: string }> };

export const HELP_TOPICS: HelpTopic[] = [
  {
    key: "start",
    title: "Getting started",
    blurb: "Find your way around",
    Icon: Compass,
    items: [
      { q: "What is Alibe?", a: "A marketplace for the Maldives. People and shops on every island sell new and used things; you message them, agree a price, and arrange the handover." },
      { q: "Where is everything?", a: "Home shows what's new and popular near you. Browse is search with filters (category, island, price). Sell lists an item in under a minute. Chats holds your conversations and offers. Profile has your listings, orders, saved items, seller account and settings." },
      { q: "Do I need an account?", a: "You can look around without one. To message sellers, save items or sell, sign in with your email (we send a code, no password) or Google." },
      { q: "Which island am I on?", a: "You pick it when you sign up, and can change it in Profile > Settings. Home and search show things near you first." },
    ],
  },
  {
    key: "buying",
    title: "Buying",
    blurb: "Find it, ask, agree a price",
    Icon: ShoppingBag,
    items: [
      { q: "How do I buy something?", a: "Open the item and tap Message to ask the seller, or Make an offer. When the seller accepts, an order is created and you agree how it gets to you: pickup, delivery or ferry." },
      { q: "How do I pay?", a: "You pay the seller directly, the way you both agree (cash on pickup, bank transfer). Alibe never holds money between buyers and sellers." },
      { q: "What's the handover code?", a: "Every order gives you a private 4-digit code. Give it to the seller only once the item is in your hands; they enter it to finish the order. It proves you received it." },
      { q: "Can I save things or searches?", a: "Tap the heart to save an item; we'll tell you if its price drops. In Browse, save a search to hear about new matches." },
      { q: "What is 'Buy through Alibe'?", a: "For items marked From iBay: Alibe checks the seller still has it, you pay Alibe the total shown, and we buy and deliver it for you." },
    ],
  },
  {
    key: "selling",
    title: "Selling",
    blurb: "Listing rules and tips",
    Icon: Tag,
    items: [
      { q: "How do I list an item?", a: "Tap Sell: add photos, a title and price, pick the category and your island. That's it." },
      { q: "Does my post go live straight away?", a: "Yes, almost always. Now and then our team checks a post first, for example if it has a link or a bank number, or a very new account is selling phones, vehicles or property. It's usually done within a few hours and you'll be told either way. Verified sellers and stores are never held." },
      { q: "Is there a limit?", a: "Up to 30 new posts a month. Premium and Store plans have no limit." },
      { q: "My post wasn't approved. What now?", a: "Open My listings > In review to see why. Edit it to fix the problem and it goes back for a quick check." },
      { q: "I sell for a business. What should I do?", a: "Register as a store (Profile > Seller account). Stores are on a paid monthly or yearly plan. Shops selling as individuals are banned." },
      { q: "How do I mark something sold?", a: "In My listings, tap the tick on the item. Buyers stop asking, and you can undo it." },
    ],
  },
  {
    key: "safety",
    title: "Staying safe",
    blurb: "Avoid scams",
    Icon: ShieldCheck,
    items: [
      { q: "The golden rules", a: "Never pay in full before you have the item. Give your handover code only when it's in your hands. Keep the conversation in Alibe chat. Be careful with links and requests to pay first, gift cards or crypto: we flag these in chats." },
      { q: "How do I report someone?", a: "On a listing or profile, or inside a chat, tap Report and choose a reason. Listings reported by several people are hidden until our team looks." },
      { q: "How do I block someone?", a: "In the chat, tap the menu > Block. They can't message you, and you can unblock in Profile > Blocked people." },
      { q: "What do the badges mean?", a: "Blue tick: the seller's ID was checked. Store: a registered business with a store page. Gold crown: Premium seller. Trust labels on profiles show deliveries, reviews and how long they've been on Alibe." },
    ],
  },
  {
    key: "orders",
    title: "Orders and delivery",
    blurb: "From offer to handover",
    Icon: Package,
    items: [
      { q: "Where are my orders?", a: "Profile > My orders, split into Buying and Selling. Anything waiting on you is at the top." },
      { q: "I'm the seller. What do I do?", a: "Deliver the item yourself (pickup, courier or ferry; for ferry, add the boat and time). When the buyer has it, ask for their handover code and enter it to finish." },
      { q: "Something went wrong", a: "Open the order and tap Report a problem. Add what happened, with photos. Our team reads both sides and decides." },
    ],
  },
  {
    key: "boosts",
    title: "Boosts and ads",
    blurb: "Get seen by more people",
    Icon: Rocket,
    items: [
      { q: "What's a boost?", a: "Your item shows at the top of its category, matching searches and the home page, with a Featured label, for 3, 7 or 30 days. Boosts are for verified sellers and stores." },
      { q: "What's an ad?", a: "A banner on the home page (with an Ad label) that opens your item or your website. Profile > Advertise on Alibe." },
      { q: "How do I pay for them?", a: "By bank transfer to Alibe. Upload your slip in Profile > My purchases; it starts once our team confirms the payment." },
    ],
  },
  {
    key: "premium",
    title: "Premium and stores",
    blurb: "Plans for regular sellers",
    Icon: Crown,
    items: [
      { q: "What does Premium include?", a: "Free 7-day boosts every month, your new items featured at the top for a week, no monthly post limit, and a gold badge. Monthly or yearly, in Profile > Seller account." },
      { q: "What does a Store plan include?", a: "A store page with your logo at alibe.online/store/your-name, the Store badge, a place above individual sellers and no post limit. Register your store first (business name, logo, registration number and the owner's ID); once it's approved, choose a plan." },
      { q: "Can a store have Premium?", a: "Yes: a store pays for the Store plan and Premium on top." },
    ],
  },
  {
    key: "verify",
    title: "Verification",
    blurb: "The blue tick",
    Icon: BadgeCheck,
    items: [
      { q: "Do I have to verify?", a: "No, it's optional and free." },
      { q: "What do I get?", a: "Your posts never wait for a check, you get the blue tick, and you can buy boosts and Premium." },
      { q: "What do you need?", a: "Your ID card number and photos of both sides of the card. No selfie." },
      { q: "What happens to my ID photos?", a: "Only Alibe's approval team sees them, and they're deleted as soon as a decision is made. We keep just the last 4 characters of your ID number." },
    ],
  },
  {
    key: "account",
    title: "Your account",
    blurb: "Profile, privacy, settings",
    Icon: UserCog,
    items: [
      { q: "How do I change my name, photo or island?", a: "Profile > tap your name, or Profile > Settings." },
      { q: "Who sees my email or phone?", a: "Nobody, unless you switch on WhatsApp or Viber buttons in Profile > WhatsApp and Viber." },
      { q: "How do I delete my account?", a: "Profile > Delete account at the bottom. Your listings, chats and profile are removed." },
    ],
  },
  {
    key: "contact",
    title: "Contact us",
    blurb: "Still stuck?",
    Icon: LifeBuoy,
    items: [{ q: "How do I reach Alibe?", a: "Email help@alibe.online with your question and, if it's about a listing or order, a link to it. We reply as soon as we can." }],
  },
];

// The questions people ask most, shown first in the help centre and at
// /help/faq. They point at answers in the topics above, so each answer is
// written once.
const FAQ_PICKS: Array<[HelpTopicKey, string]> = [
  ["buying", "How do I buy something?"],
  ["buying", "How do I pay?"],
  ["buying", "What's the handover code?"],
  ["selling", "How do I list an item?"],
  ["selling", "Does my post go live straight away?"],
  ["selling", "Is there a limit?"],
  ["safety", "The golden rules"],
  ["verify", "Do I have to verify?"],
  ["boosts", "What's a boost?"],
  ["premium", "What does Premium include?"],
  ["selling", "I sell for a business. What should I do?"],
  ["orders", "Something went wrong"],
];

export const FAQ: Array<{ q: string; a: string; topic: HelpTopicKey }> = FAQ_PICKS.flatMap(([key, q]) => {
  const item = HELP_TOPICS.find((t) => t.key === key)?.items.find((i) => i.q === q);
  return item ? [{ ...item, topic: key }] : [];
});

HELP_TOPICS.unshift({ key: "faq", title: "Frequently asked", blurb: "The quick answers", Icon: MessagesSquare, items: FAQ });
