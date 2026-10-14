import crypto from "node:crypto";
import { z } from "zod";
import { Prisma, Order } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, sendValidationError } from "../http.js";
import { publicUser, listingInclude, serializeListing } from "../serializers.js";
import { notifyUser } from "../push.js";

export const ordersRouter = safeRouter();

export const DELIVERIES_TO_VERIFY = 5;

const formatMvr = (n: number) => `MVR ${n.toLocaleString("en-US")}`;
const newHandoverCode = () => String(crypto.randomInt(1000, 10000));

type Tx = Prisma.TransactionClient;

// Creates the order for a sale and reserves the listing. Used when a seller
// accepts an offer and when they sell directly to a buyer from a chat. One
// live order per listing: a second attempt is rejected.
export async function createOrder(
  tx: Tx,
  input: { listingId: string; conversationId: string; buyerId: string; sellerId: string; amount: number; offerId?: string }
) {
  const live = await tx.order.findFirst({ where: { listingId: input.listingId, status: { in: ["AWAITING_DISPATCH", "DISPATCHED", "DELIVERED"] } } });
  if (live) return { order: live, created: false };
  const order = await tx.order.create({ data: { ...input, handoverCode: newHandoverCode() } });
  await tx.listing.update({ where: { id: input.listingId }, data: { status: "RESERVED" } });
  return { order, created: true };
}

const orderInclude = { listing: { include: listingInclude }, buyer: true, seller: true } as const;
type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// The handover code is the buyer's proof of delivery, so only the buyer ever
// receives it.
function serializeOrder(o: FullOrder, viewerId: string) {
  return {
    ...o,
    handoverCode: viewerId === o.buyerId ? o.handoverCode : null,
    listing: serializeListing(o.listing),
    buyer: publicUser(o.buyer),
    seller: publicUser(o.seller),
    // How the seller wants to be paid, so the buyer knows what to bring.
    paymentMethod: o.seller.paymentMethod,
    role: viewerId === o.sellerId ? "SELLER" : "BUYER",
  };
}

async function systemMessage(tx: Tx, order: Order, senderId: string, text: string) {
  await tx.message.create({ data: { conversationId: order.conversationId, senderId, text } });
  await tx.conversation.update({ where: { id: order.conversationId }, data: { updatedAt: new Date() } });
}

export async function deliveredCount(sellerId: string) {
  return prisma.order.count({ where: { sellerId, status: "DELIVERED" } });
}

ordersRouter.get("/mine/:userId", async (req, res) => {
  const { userId } = req.params;
  const role = req.query.role === "SELLING" ? "SELLING" : req.query.role === "BUYING" ? "BUYING" : undefined;
  const orders = await prisma.order.findMany({
    where: role === "SELLING" ? { sellerId: userId } : role === "BUYING" ? { buyerId: userId } : { OR: [{ buyerId: userId }, { sellerId: userId }] },
    include: orderInclude,
    orderBy: { updatedAt: "desc" },
  });
  res.json(orders.map((o) => serializeOrder(o, userId)));
});

ordersRouter.get("/:id", async (req, res) => {
  const userId = String(req.query.userId ?? "");
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
  if (!order) return res.status(404).json({ error: "This order no longer exists." });
  if (userId !== order.buyerId && userId !== order.sellerId) return res.status(403).json({ error: "You're not part of this order." });
  res.json(serializeOrder(order, userId));
});

// Seller sells directly to the buyer in a chat (no offer), at the asking
// price unless they enter another amount.
const directSchema = z.object({ conversationId: z.string(), sellerId: z.string(), amount: z.number().int().nonnegative().optional() });

ordersRouter.post("/", async (req, res) => {
  const parsed = directSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const conversation = await prisma.conversation.findUnique({ where: { id: parsed.data.conversationId }, include: { listing: true } });
  if (!conversation) return res.status(404).json({ error: "This conversation no longer exists." });
  if (conversation.sellerId !== parsed.data.sellerId) return res.status(403).json({ error: "Only the seller can start an order." });
  if (conversation.listing.status !== "ACTIVE") {
    const existing = await prisma.order.findFirst({ where: { listingId: conversation.listingId, conversationId: conversation.id, status: { not: "CANCELLED" } }, include: orderInclude });
    // Double tap: the order this seller just created comes back unchanged.
    if (existing) return res.status(200).json(serializeOrder(existing, parsed.data.sellerId));
    return res.status(409).json({ error: "This item is already reserved or sold." });
  }
  const amount = parsed.data.amount ?? conversation.listing.price;
  const { order } = await prisma.$transaction(async (tx) => {
    const result = await createOrder(tx, { listingId: conversation.listingId, conversationId: conversation.id, buyerId: conversation.buyerId, sellerId: conversation.sellerId, amount });
    if (result.created) await systemMessage(tx, result.order, conversation.sellerId, `Sold to you for ${formatMvr(amount)}. The seller will arrange delivery.`);
    return result;
  });
  notifyUser(order.buyerId, "Your order is confirmed", `${conversation.listing.title} for ${formatMvr(amount)}`, { type: "order", orderId: order.id, conversationId: order.conversationId });
  const full = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  res.status(201).json(serializeOrder(full, parsed.data.sellerId));
});

// The seller ships the item. Ferry shipments must name the boat and its
// departure; courier shipments name the courier.
const dispatchSchema = z
  .object({
    userId: z.string(),
    method: z.enum(["PICKUP", "FERRY", "COURIER"]),
    boatName: z.string().trim().max(80).optional(),
    boatDeparture: z.coerce.date().optional(),
    cargoReference: z.string().trim().max(40).optional(),
    courierName: z.string().trim().max(80).optional(),
    pickupNote: z.string().trim().max(200).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.method === "FERRY" && !d.boatName) ctx.addIssue({ code: "custom", message: "Enter the boat's name so the buyer knows which ferry to meet." });
    if (d.method === "FERRY" && !d.boatDeparture) ctx.addIssue({ code: "custom", message: "Enter when the boat departs." });
    if (d.method === "COURIER" && !d.courierName) ctx.addIssue({ code: "custom", message: "Enter the courier or driver's name." });
  });

ordersRouter.post("/:id/dispatch", async (req, res) => {
  const parsed = dispatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Please fill in the delivery details." });
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { listing: true } });
  if (!order) return res.status(404).json({ error: "This order no longer exists." });
  if (order.sellerId !== parsed.data.userId) return res.status(403).json({ error: "Only the seller can send the item." });

  const { userId, method, ...details } = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    // Validation gate: dispatch happens once, from "awaiting dispatch" only.
    const changed = await tx.order.updateMany({
      where: { id: order.id, status: "AWAITING_DISPATCH" },
      data: { status: "DISPATCHED", deliveryMethod: method, dispatchedAt: new Date(), ...details },
    });
    if (!changed.count) return false;
    const text =
      method === "FERRY"
        ? `Sent by ferry on ${details.boatName}, departing ${details.boatDeparture!.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Indian/Maldives" })}${details.cargoReference ? ` (cargo ref ${details.cargoReference})` : ""}. Confirm in the app once you have it.`
        : method === "COURIER"
        ? `Out for delivery with ${details.courierName}. Confirm in the app once you have it.`
        : `Ready for pickup${details.pickupNote ? `: ${details.pickupNote}` : ""}. Show your handover code when you collect it.`;
    await systemMessage(tx, order, userId, text);
    return true;
  });
  const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  if (!updated) {
    if (current.status === "DISPATCHED") return res.json(serializeOrder(current, userId));
    return res.status(409).json({ error: "This order can't be sent any more." });
  }
  notifyUser(
    order.buyerId,
    method === "FERRY" ? "Your item is on the ferry" : method === "COURIER" ? "Your item is on its way" : "Your item is ready for pickup",
    order.listing.title,
    { type: "order", orderId: order.id, conversationId: order.conversationId }
  );
  res.json(serializeOrder(current, userId));
});

// Delivery verification. The buyer holds the code and only releases it once
// the item is in their hands; the seller completes the delivery by entering
// it. The party who benefits from "delivered" (the seller) can never finish
// it alone, and there's no tap-to-confirm shortcut.
const MAX_CODE_ATTEMPTS = 5;
const confirmSchema = z.object({ userId: z.string(), code: z.string().trim() });

ordersRouter.post("/:id/confirm", async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter the buyer's 4-digit handover code." });
  const { userId, code } = parsed.data;
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { listing: true } });
  if (!order) return res.status(404).json({ error: "This order no longer exists." });
  if (userId !== order.sellerId) return res.status(403).json({ error: "The seller confirms delivery by entering the buyer's code." });
  if (order.status === "DELIVERED") {
    const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    return res.json({ order: serializeOrder(current, userId), becameVerified: false });
  }
  if (order.status !== "DISPATCHED") {
    return res.status(409).json({ error: order.status === "AWAITING_DISPATCH" ? "Mark the item as sent or ready for pickup first." : "This order can't be confirmed any more." });
  }
  // Brute-force guard: 10,000 possible codes, so lock after a few misses.
  if (order.codeAttempts >= MAX_CODE_ATTEMPTS) {
    return res.status(423).json({ error: "Too many wrong codes. Ask the buyer to create a new code in their order." });
  }
  if (code !== order.handoverCode) {
    const updated = await prisma.order.update({ where: { id: order.id }, data: { codeAttempts: { increment: 1 } } });
    const left = MAX_CODE_ATTEMPTS - updated.codeAttempts;
    return res.status(400).json({
      error: left > 0 ? `That code doesn't match. ${left} attempt${left === 1 ? "" : "s"} left.` : "That code doesn't match, and the code is now locked. Ask the buyer to create a new one.",
    });
  }

  const delivered = await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: order.id, status: "DISPATCHED", handoverCode: code },
      data: { status: "DELIVERED", deliveredAt: new Date(), verifiedBy: "HANDOVER_CODE" },
    });
    if (!changed.count) return false;
    await tx.listing.update({ where: { id: order.listingId }, data: { status: "SOLD" } });
    await systemMessage(tx, order, userId, "Delivered and verified with the buyer's handover code.");
    return true;
  });

  const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  if (!delivered) return res.json({ order: serializeOrder(current, userId), becameVerified: false });

  // Five verified deliveries earn the verified-seller badge.
  const count = await deliveredCount(order.sellerId);
  let becameVerified = false;
  if (count >= DELIVERIES_TO_VERIFY) {
    const result = await prisma.user.updateMany({ where: { id: order.sellerId, verificationStatus: "NONE" }, data: { verificationStatus: "VERIFIED", verifiedAt: new Date() } });
    becameVerified = result.count > 0;
  }
  notifyUser(order.buyerId, "Delivery complete", `${order.listing.title} is marked as delivered.`, { type: "order", orderId: order.id, conversationId: order.conversationId });
  if (becameVerified) {
    notifyUser(order.sellerId, "You're now a verified seller", `${DELIVERIES_TO_VERIFY} verified deliveries. The blue tick now shows on your listings.`, { type: "order", orderId: order.id, conversationId: order.conversationId });
  }
  res.json({ order: serializeOrder(current, userId), becameVerified, delivered: count });
});

// Buyer replaces their code (after a lockout, or if they think it leaked).
ordersRouter.post("/:id/new-code", async (req, res) => {
  const userId = String(req.body?.userId ?? "");
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "This order no longer exists." });
  if (order.buyerId !== userId) return res.status(403).json({ error: "Only the buyer can change the handover code." });
  if (!["AWAITING_DISPATCH", "DISPATCHED"].includes(order.status)) return res.status(409).json({ error: "This order is already closed." });
  await prisma.order.update({ where: { id: order.id }, data: { handoverCode: newHandoverCode(), codeAttempts: 0 } });
  const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  res.json(serializeOrder(current, userId));
});

// Remote deliveries (ferry/courier): once the buyer has the item, they can
// post their code into the chat for the seller. The buyer still decides when.
ordersRouter.post("/:id/share-code", async (req, res) => {
  const userId = String(req.body?.userId ?? "");
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: "This order no longer exists." });
  if (order.buyerId !== userId) return res.status(403).json({ error: "Only the buyer can share the handover code." });
  if (order.status !== "DISPATCHED") return res.status(409).json({ error: "You can share the code once the seller has sent the item." });
  await prisma.$transaction(async (tx) => systemMessage(tx, order, userId, `I've received the item. My handover code is ${order.handoverCode}.`));
  notifyUser(order.sellerId, "The buyer received the item", "Open the order and enter their handover code to finish the delivery.", { type: "order", orderId: order.id, conversationId: order.conversationId });
  res.status(204).send();
});

const problemSchema = z.object({ userId: z.string(), details: z.string().trim().min(5).max(500) });

ordersRouter.post("/:id/problem", async (req, res) => {
  const parsed = problemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Tell us briefly what went wrong (at least a few words)." });
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { listing: true } });
  if (!order) return res.status(404).json({ error: "This order no longer exists." });
  if (order.buyerId !== parsed.data.userId) return res.status(403).json({ error: "Only the buyer can report a delivery problem." });
  const changed = await prisma.$transaction(async (tx) => {
    const c = await tx.order.updateMany({ where: { id: order.id, status: { in: ["AWAITING_DISPATCH", "DISPATCHED"] } }, data: { status: "DISPUTED", problem: parsed.data.details } });
    if (c.count) await systemMessage(tx, order, order.buyerId, `Reported a problem with this delivery: ${parsed.data.details}`);
    return c.count > 0;
  });
  const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  if (!changed && current.status !== "DISPUTED") return res.status(409).json({ error: "This order is already closed." });
  if (changed) notifyUser(order.sellerId, "A buyer reported a delivery problem", order.listing.title, { type: "order", orderId: order.id, conversationId: order.conversationId });
  res.json(serializeOrder(current, parsed.data.userId));
});

const cancelSchema = z.object({ userId: z.string() });

ordersRouter.post("/:id/cancel", async (req, res) => {
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { listing: true } });
  if (!order) return res.status(404).json({ error: "This order no longer exists." });
  if (order.sellerId !== parsed.data.userId) return res.status(403).json({ error: "Only the seller can cancel an order." });
  const changed = await prisma.$transaction(async (tx) => {
    const c = await tx.order.updateMany({ where: { id: order.id, status: "AWAITING_DISPATCH" }, data: { status: "CANCELLED" } });
    if (!c.count) return false;
    await tx.listing.update({ where: { id: order.listingId }, data: { status: "ACTIVE" } });
    await systemMessage(tx, order, order.sellerId, "Cancelled this order. The item is available again.");
    return true;
  });
  const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  if (!changed && current.status !== "CANCELLED") return res.status(409).json({ error: "Orders can only be cancelled before the item is sent." });
  if (changed) notifyUser(order.buyerId, "Order cancelled", order.listing.title, { type: "order", orderId: order.id, conversationId: order.conversationId });
  res.json(serializeOrder(current, parsed.data.userId));
});
