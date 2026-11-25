import crypto from "node:crypto";
import type { CardPayment, Order, Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { plansFor } from "./sellers.js";
import { moneySettings } from "./money.js";
import { bmlPaid, cardMode, createBmlTransaction, getBmlTransaction, SIM_PREFIX } from "./bml.js";
import { notifyUser } from "./push.js";

// Card payments for item sales.
//
// The rule: Premium sellers and stores with a live plan can switch on card
// payments (Seller account), once they've added the bank account to be paid
// to. Their buyers can then pay an order by card. The money goes to Alibe's BML
// account and Alibe HOLDS it:
//   - delivered (the buyer's handover code, or staff settling a dispute for the
//     seller): staff pay the seller, minus Alibe's card fee, once the hold
//     days have passed (protects against stolen cards and chargebacks);
//   - cancelled (by the seller, a ban, or staff settling a dispute for the
//     buyer): staff refund the buyer;
//   - paid twice by accident: the extra payment is refunded.
// Paying by card is optional: buyers can still pay the seller directly.
//
// Security:
//   - the amount is the order's, set by the server; the app never sends one;
//   - only the order's buyer can start or check a payment;
//   - an order only counts as paid when the server has looked the transaction
//     up at BML itself (amount, currency and reference must match); redirects
//     and webhooks are never trusted on their own (src/bml.ts);
//   - state changes lock the order row, so two payments finishing at the same
//     moment can't both count: the second becomes a refund;
//   - payouts go to a separate PayoutAccount table no user lookup returns, and
//     changing it alerts the seller and flags it to staff.

const ACTIVE_ORDER = ["AWAITING_DISPATCH", "DISPATCHED", "DISPUTED"] as const;
// Payments that mean the order is paid (or was, and is being settled).
const COUNTED = ["HELD", "PAYOUT_DUE", "PAID_OUT"] as const;
// Starting checkouts over and over: a few per hour is plenty.
const MAX_CHECKOUTS_PER_HOUR = 6;
const publicUrl = () => process.env.PUBLIC_URL ?? "https://alibe.online";
const formatMvr = (n: number) => `MVR ${n.toLocaleString("en-US")}`;

type Tx = Prisma.TransactionClient;

// ---- who can take card payments ---------------------------------------------

export type SellerCardState = {
  // Premium or a live store plan (the rule).
  eligible: boolean;
  on: boolean;
  payoutReady: boolean;
  // Card payments are set up on Alibe's side (live BML key or test mode).
  siteReady: boolean;
  // All of the above: buyers can pay this seller by card.
  accepts: boolean;
};

export async function sellerCardStates(sellerIds: string[]): Promise<Map<string, SellerCardState>> {
  const ids = [...new Set(sellerIds)];
  const out = new Map<string, SellerCardState>();
  if (!ids.length) return out;
  const [users, plans, mode] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, verificationStatus: true, bannedAt: true, store: { select: { status: true } }, payoutAccount: { select: { cardPaymentsOn: true, accountNumber: true } } } }),
    plansFor(ids),
    cardMode(),
  ]);
  for (const u of users) {
    const p = plans.get(u.id)!;
    const storeApproved = u.store?.status === "APPROVED";
    const approved = u.verificationStatus === "VERIFIED" || storeApproved;
    const eligible = !u.bannedAt && ((approved && !!p.premium) || (storeApproved && !!p.store));
    const on = !!u.payoutAccount?.cardPaymentsOn;
    const payoutReady = !!u.payoutAccount?.accountNumber;
    const siteReady = mode !== "off";
    out.set(u.id, { eligible, on, payoutReady, siteReady, accepts: eligible && on && payoutReady && siteReady });
  }
  return out;
}

// Test mode is a pretend checkout (no real money), switched on site-wide for a
// day at a time. For item sales only Alibe staff accounts get it, so a real
// buyer can never "pay" a seller with pretend money and have them ship.
export async function buyerCanPayByCard(buyerId: string | undefined) {
  const mode = await cardMode();
  if (mode === "live") return true;
  if (mode === "off" || !buyerId) return false;
  const u = await prisma.user.findUnique({ where: { id: buyerId }, select: { isAdmin: true, staffRoles: true } });
  return !!u && (u.isAdmin || u.staffRoles.length > 0);
}

export const sellerCardState = async (sellerId: string) =>
  (await sellerCardStates([sellerId])).get(sellerId) ?? { eligible: false, on: false, payoutReady: false, siteReady: false, accepts: false };

// ---- what the order screen shows --------------------------------------------

type WithPayments = Order & { cardPayments?: CardPayment[] };

// The payment that decides the order's card state: one that's counted, else
// one owed back, else the latest.
function currentPayment(payments: CardPayment[]) {
  return (
    payments.find((p) => (COUNTED as readonly string[]).includes(p.status)) ??
    payments.find((p) => p.status === "REFUND_DUE" || p.status === "REFUNDED") ??
    null
  );
}

export async function cardView(order: WithPayments, viewerId: string) {
  const payments = order.cardPayments ?? (await prisma.cardPayment.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } }));
  const current = currentPayment(payments);
  const seller = viewerId === order.sellerId;
  const paid = !!current && (COUNTED as readonly string[]).includes(current.status);
  // Pay by card: the buyer, an open order not yet paid, a seller who takes cards.
  let available = false;
  if (!seller && !paid && (order.status === "AWAITING_DISPATCH" || order.status === "DISPATCHED")) {
    available = (await sellerCardState(order.sellerId)).accepts && (await buyerCanPayByCard(viewerId));
  }
  return {
    available,
    status: current?.status ?? null,
    amount: current?.amount ?? order.amount,
    // Test mode: a pretend checkout, no real money.
    test: current ? current.test : available && (await cardMode()) === "simulated",
    paidAt: current?.paidAt ?? null,
    refundReason: current?.refundReason ?? null,
    // The payout is the seller's business only.
    ...(seller && current ? { fee: current.fee, payout: current.amount - current.fee, payoutDueAt: current.payoutDueAt } : {}),
    // A second payment that will be refunded (buyer's view).
    extraRefund: !seller && payments.some((p) => p !== current && (p.status === "REFUND_DUE" || p.status === "REFUNDED")),
  };
}

// ---- paying -------------------------------------------------------------------

const newReference = () => `AO-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

export class CardError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Starts a card payment for the buyer: returns the payment page to open.
export async function startOrderCardPayment(orderId: string, buyerId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { cardPayments: true } });
  if (!order || order.buyerId !== buyerId) throw new CardError(404, "We couldn't find that order.");
  if (order.status !== "AWAITING_DISPATCH" && order.status !== "DISPATCHED") throw new CardError(409, "This order can't be paid by card now.");
  if (order.cardPayments.some((p) => (COUNTED as readonly string[]).includes(p.status))) throw new CardError(409, "This order is already paid by card.");
  if (order.amount <= 0) throw new CardError(409, "There's nothing to pay for this order.");
  const state = await sellerCardState(order.sellerId);
  if (!state.accepts) throw new CardError(409, "This seller doesn't take card payments right now. Please pay them directly.");
  if (!(await buyerCanPayByCard(buyerId))) throw new CardError(409, "Card payments are in test mode, so only Alibe staff can try them. Please pay the seller directly.");
  const recent = order.cardPayments.filter((p) => p.createdAt.getTime() > Date.now() - 3600_000).length;
  if (recent >= MAX_CHECKOUTS_PER_HOUR) throw new CardError(429, "Too many card payment attempts. Please wait a while and try again.");

  // A checkout still open from a moment ago: let BML settle it first, so the
  // buyer can't end up paying twice by tapping again.
  for (const p of order.cardPayments.filter((p) => p.status === "PENDING" && p.gatewayRef)) {
    await settleOrderCardPayment(p.id).catch(() => {});
  }
  const again = await prisma.cardPayment.findFirst({ where: { orderId, status: { in: [...COUNTED] } } });
  if (again) throw new CardError(409, "This order is already paid by card.");

  const m = await moneySettings();
  const fee = Math.round((order.amount * m.cardFeePercent) / 100);
  const payment = await prisma.cardPayment.create({
    data: { orderId, buyerId, sellerId: order.sellerId, amount: order.amount, fee, reference: newReference(), test: (await cardMode()) === "simulated" },
  });
  try {
    const tx = await createBmlTransaction({
      amountMvr: payment.amount,
      reference: payment.reference,
      redirectUrl: `${publicUrl()}/order/${orderId}?paid=${payment.id}`,
      purchaseId: payment.id,
      site: publicUrl(),
    });
    if (!tx.id || !tx.url) throw new Error(`BML returned no transaction: ${JSON.stringify(tx).slice(0, 200)}`);
    await prisma.cardPayment.update({ where: { id: payment.id }, data: { gatewayRef: tx.id } });
    return { url: tx.url };
  } catch (e) {
    await prisma.cardPayment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    console.error("[card] create", e);
    throw new CardError(502, "Card payment isn't working right now. Please pay the seller directly, or try again later.");
  }
}

// Asks BML whether a payment went through and records it. Safe to call any
// number of times (from the app coming back, the webhook, or a retry).
export async function settleOrderCardPayment(paymentId: string) {
  const payment = await prisma.cardPayment.findUnique({ where: { id: paymentId } });
  if (!payment?.gatewayRef || payment.status !== "PENDING") return payment?.status ?? null;
  const simulated = payment.gatewayRef.startsWith(SIM_PREFIX);
  if (!simulated && (await cardMode()) !== "live") return payment.status;
  const tx = await getBmlTransaction(payment.gatewayRef);
  if (!bmlPaid(tx, { amountMvr: payment.amount, reference: payment.reference })) {
    // Declined or cancelled on the card page: closed (a new one can be started).
    if (tx.state === "CANCELLED" || tx.state === "FAILED" || tx.state === "EXPIRED") {
      await prisma.cardPayment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "FAILED" } });
      return "FAILED";
    }
    return payment.status;
  }

  // Paid. Decide what it means with the order locked, so two payments
  // finishing together can't both count.
  const result = await prisma.$transaction(async (db) => {
    await db.$queryRaw`SELECT id FROM "Order" WHERE id = ${payment.orderId} FOR UPDATE`;
    const order = await db.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { listing: { select: { title: true } } } });
    const fresh = await db.cardPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (fresh.status !== "PENDING") return null;
    const already = await db.cardPayment.findFirst({ where: { orderId: order.id, id: { not: payment.id }, status: { in: [...COUNTED] } } });
    const now = new Date();
    let status: CardPayment["status"];
    let refundReason: string | null = null;
    let payoutDueAt: Date | null = null;
    if (already) {
      status = "REFUND_DUE";
      refundReason = "Paid twice: this second payment is refunded.";
    } else if (order.status === "CANCELLED") {
      status = "REFUND_DUE";
      refundReason = "The order was cancelled.";
    } else if (order.status === "DELIVERED") {
      status = "PAYOUT_DUE";
      payoutDueAt = await holdUntil(now);
    } else {
      status = "HELD";
    }
    await db.cardPayment.update({ where: { id: payment.id }, data: { status, paidAt: now, refundReason, payoutDueAt } });
    if (status === "HELD" || status === "PAYOUT_DUE") {
      await db.message.create({
        data: { conversationId: order.conversationId, senderId: order.buyerId, text: `Paid ${formatMvr(payment.amount)} by card${payment.test ? " (test payment, no real money)" : ""}. Alibe holds it until delivery is confirmed with the handover code.` },
      });
      await db.conversation.update({ where: { id: order.conversationId }, data: { updatedAt: now } });
    }
    return { status, order };
  });
  if (!result) return (await prisma.cardPayment.findUnique({ where: { id: payment.id } }))?.status ?? null;
  const data = { type: "order", orderId: result.order.id, conversationId: result.order.conversationId };
  if (result.status === "HELD" || result.status === "PAYOUT_DUE") {
    notifyUser(result.order.sellerId, "Paid by card", `The buyer paid ${formatMvr(payment.amount)} for ${result.order.listing.title}. Alibe holds it until delivery: send the item as usual.`, data);
  } else {
    notifyUser(result.order.buyerId, "Your card payment will be refunded", `${result.order.listing.title}: this payment wasn't needed, so Alibe will refund it.`, data);
  }
  return result.status;
}

async function holdUntil(from: Date) {
  const m = await moneySettings();
  return new Date(from.getTime() + m.cardHoldDays * 86_400_000);
}

// ---- when the order moves on ----------------------------------------------------

// Delivered (handover code, or a dispute settled for the seller): the held
// payment becomes due to the seller after the hold days.
export async function cardOnDelivered(db: Tx, orderId: string) {
  const due = await holdUntil(new Date());
  await db.cardPayment.updateMany({ where: { orderId, status: "HELD" }, data: { status: "PAYOUT_DUE", payoutDueAt: due } });
}

// Cancelled (seller, ban, or a dispute settled for the buyer): the buyer is
// refunded. Returns whether there was a card payment to refund.
export async function cardOnCancelled(db: Tx, orderId: string, reason: string) {
  const { count } = await db.cardPayment.updateMany({ where: { orderId, status: "HELD" }, data: { status: "REFUND_DUE", refundReason: reason } });
  return count > 0;
}

export const hasHeldCardPayment = async (orderId: string) => !!(await prisma.cardPayment.findFirst({ where: { orderId, status: "HELD" }, select: { id: true } }));

// The webhook and the test checkout: find the card payment for a transaction.
export const cardPaymentForGateway = (gatewayRef: string) => prisma.cardPayment.findUnique({ where: { gatewayRef } });

export { ACTIVE_ORDER };
