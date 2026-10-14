import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Banknote,
  Check,
  CheckCircle2,
  Handshake,
  KeyRound,
  Landmark,
  MessageCircle,
  Package,
  Ship,
  Truck,
  AlertTriangle,
  XCircle,
} from "lucide-react-native";
import { api, DeliveryOption, DispatchDetails, errorMessage, newClientId, Order } from "../api/client";
import { ContactIconButtons } from "../components/ContactButtons";
import { useAuth, DRAFT_PREFIX } from "../api/AuthContext";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { ListingImage } from "../components/ListingCard";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useAppAlert } from "../components/AppAlertProvider";
import { Sheet } from "../components/Sheet";
import { ReviewSheet } from "../components/TrustSheets";
import Tap from "../components/Tap";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { usePersistentState } from "../hooks/usePersistentState";
import { useResponsive } from "../hooks/useResponsive";
import { animateLayout, FadeIn, FillLine, Pop, SuccessBurst, useShake } from "../components/Motion";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";

const CODE_LENGTH = 4;
const MAX_CODE_ATTEMPTS = 5;

const METHODS: Array<{ value: DeliveryOption; label: string; hint: string; Icon: typeof Ship }> = [
  { value: "PICKUP", label: "Meet in person", hint: "The buyer collects it from you", Icon: Handshake },
  { value: "FERRY", label: "Send by ferry", hint: "Put it on a boat to their island", Icon: Ship },
  { value: "COURIER", label: "Courier or driver", hint: "Someone delivers it for you", Icon: Truck },
];

// Next few days as Maldives-time calendar dates, for the ferry departure.
function upcomingDays(count = 4) {
  const mvNow = new Date(Date.now() + 5 * 3600 * 1000);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(mvNow.getUTCFullYear(), mvNow.getUTCMonth(), mvNow.getUTCDate() + i));
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
    const iso = d.toISOString().slice(0, 10);
    return { label, iso };
  });
}

// "2:30" + PM on a given day -> ISO timestamp in Maldives time, or null.
function departureIso(dayIso: string, time: string, pm: boolean) {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 1 || h > 12 || min > 59) return null;
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return `${dayIso}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+05:00`;
}

const formatMvr = (n: number) => `MVR ${n.toLocaleString()}`;
const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Indian/Maldives" });

export default function OrderDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { isDesktopWeb, gutter } = useResponsive();
  const orderId: string = route.params?.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Moving to a new step (sent, delivered...) animates the layout change.
  const updateOrder = useCallback((next: Order) => {
    setOrder((prev) => {
      if (prev && prev.status !== next.status) animateLayout();
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    if (!user || !orderId) return;
    try {
      updateOrder(await api.order(orderId, user.id));
      setFailed(false);
    } catch {
      setOrder((prev) => {
        if (!prev) setFailed(true);
        return prev;
      });
    } finally {
      setRefreshing(false);
    }
  }, [user, orderId, updateOrder]);

  // Refresh on focus and every 15s while open, so each side sees the other's
  // step (sent, code shared, delivered) without pulling.
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 15000);
      return () => clearInterval(t);
    }, [load])
  );

  if (failed) {
    return (
      <View style={styles.container}>
        {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title="Order" />}
        <EmptyState icon={Package} tone="error" title="Order unavailable" message="We couldn't load this order. Check your connection and try again." actionLabel="Try again" onAction={load} />
      </View>
    );
  }

  const isSeller = order?.role === "SELLER";
  const other = order ? (isSeller ? order.buyer : order.seller) : null;

  const body = !order ? (
    <OrderSkeleton />
  ) : (
    <>
      <FadeIn>
      <View style={styles.itemCard}>
        <ListingImage uri={order.listing.images[0]} style={styles.itemThumb} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {order.listing.title}
          </Text>
          <Text style={styles.itemPrice}>{formatMvr(order.amount)}</Text>
          <Text style={styles.itemMeta} numberOfLines={1}>
            {isSeller ? `Sold to ${order.buyer.name}` : `From ${order.seller.name}`}
          </Text>
        </View>
      </View>

      </FadeIn>

      <FadeIn delay={70}>
        <Steps order={order} />
      </FadeIn>

      <FadeIn key={order.status} delay={140} style={{ gap: spacing.md }}>
        <NextStep order={order} onChange={updateOrder} onReport={() => setProblemOpen(true)} onReview={() => setReviewOpen(true)} />
      </FadeIn>

      {(order.status === "AWAITING_DISPATCH" || order.status === "DISPATCHED") && (
        <FadeIn delay={210}>
          <PaymentCard order={order} />
        </FadeIn>
      )}

      <FadeIn delay={260}>
      <Tap style={styles.chatButton} onPress={() => navigation.navigate("ChatThread", { id: order.conversationId })} scaleTo={0.97}>
        <MessageCircle size={20} color={colors.primary} />
        <Text style={styles.chatButtonText}>Message {other?.name}</Text>
      </Tap>
      </FadeIn>

      {order.status === "AWAITING_DISPATCH" && isSeller && <CancelLink order={order} onChange={updateOrder} />}
      {(order.status === "AWAITING_DISPATCH" || order.status === "DISPATCHED") && !isSeller && (
        <Tap style={styles.textLink} onPress={() => setProblemOpen(true)} scaleTo={0.96}>
          <Text style={styles.textLinkText}>Something wrong? Report a problem</Text>
        </Tap>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title={isSeller ? "Your sale" : "Your order"} />}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: gutter, paddingBottom: insets.bottom + spacing.xl },
          isDesktopWeb && styles.desktopColumn,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {body}
      </ScrollView>
      {order && <ProblemSheet visible={problemOpen} onClose={() => setProblemOpen(false)} order={order} onChange={updateOrder} />}
      {order && <ReviewSheet visible={reviewOpen} onClose={() => setReviewOpen(false)} listingId={order.listingId} sellerName={order.seller.name} />}
    </View>
  );

}

function CancelLink({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const showAlert = useAppAlert();
  const [cancel] = useSingleFlight(async () => {
    if (!user) return;
    const before = order;
    onChange({ ...order, status: "CANCELLED" });
    try {
      onChange(await api.cancelOrder(order.id, user.id));
      toast.success("Order cancelled. Your item is for sale again.");
    } catch (e) {
      onChange(before);
      toast.error(errorMessage(e, "Couldn't cancel the order. Please try again."));
    }
  });
  return (
    <Tap
      style={styles.textLink}
      scaleTo={0.96}
      onPress={() =>
        showAlert({
          title: "Cancel this order?",
          message: `${order.buyer.name} will be told, and your item goes back on sale.`,
          kind: "warning",
          buttons: [
            { text: "Keep order", style: "cancel" },
            { text: "Cancel order", style: "destructive", onPress: cancel },
          ],
        })
      }
    >
      <Text style={[styles.textLinkText, { color: colors.danger }]}>Can't sell it any more? Cancel order</Text>
    </Tap>
  );
}

// Three-step progress bar: confirmed -> sent -> delivered.
function Steps({ order }: { order: Order }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const seller = order.role === "SELLER";
  const labels = seller ? ["Sold", "Sent", "Delivered"] : ["Confirmed", "On the way", "Received"];
  const reached = order.status === "AWAITING_DISPATCH" ? 1 : order.status === "DISPATCHED" ? 2 : order.status === "DELIVERED" ? 3 : 0;
  if (order.status === "CANCELLED" || order.status === "DISPUTED") return null;
  return (
    <View style={styles.steps}>
      {labels.map((label, i) => {
        const done = i < reached;
        const current = i === reached - 1 && order.status !== "DELIVERED";
        return (
          <React.Fragment key={label}>
            {i > 0 && <FillLine filled={i < reached} color={colors.success} track={colors.border} style={styles.stepLine} />}
            <View style={styles.step}>
              <View style={[styles.stepDot, done && { backgroundColor: colors.success, borderColor: colors.success }, current && { borderColor: colors.success }]}>
                {done ? (
                  <Pop delay={120 + i * 140}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </Pop>
                ) : (
                  <Text style={styles.stepNum}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, done && { color: colors.text, fontWeight: fontWeight.semibold }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// The single "what do I do now" card, different for each side and status.
function NextStep({ order, onChange, onReport, onReview }: { order: Order; onChange: (o: Order) => void; onReport: () => void; onReview: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const seller = order.role === "SELLER";

  if (order.status === "AWAITING_DISPATCH") {
    return seller ? (
      <SendItemCard order={order} onChange={onChange} />
    ) : (
      <>
        <Card icon={Package} title={`${order.seller.name} is getting your item ready`} text={`We'll tell you as soon as it's on the way. If ${order.seller.name} is slow, we'll remind them for you.`} />
        <CodeCard order={order} onChange={onChange} />
      </>
    );
  }
  if (order.status === "DISPATCHED") {
    return seller ? <EnterCodeCard order={order} onChange={onChange} /> : <BuyerOnTheWay order={order} onChange={onChange} />;
  }
  if (order.status === "DELIVERED") {
    return (
      <View style={[styles.card, styles.celebrate]}>
        <SuccessBurst color={colors.success} size={72}>
          <CheckCircle2 size={38} color={colors.success} strokeWidth={2.2} />
        </SuccessBurst>
        <Pop delay={250} from={0.85}>
          <Text style={styles.celebrateTitle}>All done!</Text>
        </Pop>
        <Text style={[styles.cardText, { textAlign: "center" }]}>
          {seller ? `${order.buyer.name} has the item. This sale is complete.` : `Enjoy your item. How was ${order.seller.name}?`}
        </Text>
        {!seller && (
          <View style={{ alignSelf: "stretch" }}>
            <BigButton label="Rate the seller" onPress={onReview} />
          </View>
        )}
      </View>
    );
  }
  if (order.status === "DISPUTED") {
    return (
      <Card
        icon={AlertTriangle}
        color={colors.danger}
        title="A problem was reported"
        text={`${order.problem ?? "The buyer reported a problem."}\n\nPlease sort it out together in the chat.`}
      />
    );
  }
  return <Card icon={XCircle} color={colors.textMuted} title="This order was cancelled" text={seller ? "The item is for sale again." : "Nothing more to do here."} />;
}

function Card({ icon: Icon, color, title, text, children }: { icon: typeof Ship; color?: string; title: string; text?: string; children?: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const c = color ?? colors.primary;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIcon, { backgroundColor: `${c}1A` }]}>
          <Icon size={22} color={c} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {!!text && <Text style={styles.cardText}>{text}</Text>}
      {children}
    </View>
  );
}

function BigButton({ label, onPress, busy, disabled, tone }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; tone?: "primary" | "success" }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Tap
      style={[styles.bigButton, { backgroundColor: tone === "success" ? colors.success : colors.primary }, (disabled || busy) && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled || busy}
      scaleTo={0.97}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigButtonText}>{label}</Text>}
    </Tap>
  );
}

function Field({ label, optional, ...props }: React.ComponentProps<typeof TextInput> & { label: string; optional?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={styles.fieldLabel}>
        {label}
        {optional && <Text style={styles.optional}> (optional)</Text>}
      </Text>
      <TextInput style={styles.input} placeholderTextColor={colors.textMuted} {...props} />
    </View>
  );
}

function SendItemCard({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const days = upcomingDays();
  const [form, setForm, { clear }] = usePersistentState(`${DRAFT_PREFIX}dispatch.${order.id}`, {
    method: (order.listing.deliveryOptions?.[0] ?? "PICKUP") as DeliveryOption,
    pickupNote: "",
    boatName: "",
    day: days[0].iso,
    time: "",
    pm: false,
    cargoReference: "",
    courierName: "",
    greeted: false,
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const onTime = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, 4);
    set({ time: digits.length > 2 ? `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}` : digits });
  };

  const departure = departureIso(form.day, form.time, form.pm);
  const missing =
    form.method === "FERRY"
      ? !form.boatName.trim()
        ? "Enter the boat's name"
        : !departure
        ? "Enter when the boat leaves, like 2:30"
        : null
      : form.method === "COURIER" && !form.courierName.trim()
      ? "Enter the courier or driver's name"
      : null;

  // Step 1: a ready-made message so the buyer hears from the seller straight
  // away instead of waiting in silence.
  const greeting = `Hi ${order.buyer.name}! Thanks for buying ${order.listing.title}. I'll get it to you soon. Where are you, and how would you like to get it?`;
  const [greet, greetBusy] = useSingleFlight(async () => {
    if (!user) return;
    set({ greeted: true });
    try {
      await api.sendMessage(order.conversationId, user.id, greeting, newClientId());
      toast.success(`Message sent to ${order.buyer.name}.`);
    } catch (e) {
      set({ greeted: false });
      toast.error(errorMessage(e, "Couldn't send the message. Please try again."));
    }
  });

  const [send, busy] = useSingleFlight(async () => {
    if (!user || missing) return;
    const details: DispatchDetails =
      form.method === "FERRY"
        ? { method: "FERRY", boatName: form.boatName.trim(), boatDeparture: departure!, cargoReference: form.cargoReference.trim() || undefined }
        : form.method === "COURIER"
        ? { method: "COURIER", courierName: form.courierName.trim() }
        : { method: "PICKUP", pickupNote: form.pickupNote.trim() || undefined };
    const before = order;
    onChange({ ...order, status: "DISPATCHED", deliveryMethod: form.method, ...details, dispatchedAt: new Date().toISOString() } as Order);
    try {
      onChange(await api.dispatchOrder(order.id, user.id, details));
      clear();
      toast.success(form.method === "PICKUP" ? `${order.buyer.name} has been told it's ready.` : `${order.buyer.name} has been told it's on the way.`);
    } catch (e) {
      onChange(before);
      toast.error(errorMessage(e, "Couldn't save that. Please try again."));
    }
  });

  return (
    <Card icon={Package} title={`Send the item to ${order.buyer.name}`} text={`${order.buyer.name} is waiting. Do these two steps now.`}>
      <Text style={styles.stepHeading}>1. Tell {order.buyer.name} you're on it</Text>
      {form.greeted ? (
        <FadeIn style={styles.doneRow}>
          <CheckCircle2 size={20} color={colors.success} />
          <Text style={styles.doneText}>Message sent. Their reply will be in the chat.</Text>
        </FadeIn>
      ) : (
        <>
          <View style={styles.quote}>
            <Text style={styles.quoteText}>"{greeting}"</Text>
          </View>
          <Tap style={styles.secondaryButton} onPress={greet} disabled={greetBusy} scaleTo={0.97}>
            {greetBusy ? <ActivityIndicator color={colors.primary} /> : <MessageCircle size={18} color={colors.primary} />}
            <Text style={styles.secondaryButtonText}>Send this message</Text>
          </Tap>
        </>
      )}
      {(order.buyer.phone || order.buyer.whatsapp || order.buyer.viber) && (
        <View style={styles.callRow}>
          <Text style={styles.callText}>Or call them:</Text>
          <ContactIconButtons contact={order.buyer} size={40} />
        </View>
      )}

      <Text style={[styles.stepHeading, { marginTop: spacing.lg }]}>2. How will they get it?</Text>
      <View style={{ gap: spacing.sm }}>
        {METHODS.map(({ value, label, hint, Icon }) => {
          const active = form.method === value;
          return (
            <Tap key={value} style={[styles.method, active && styles.methodActive]} onPress={() => {
              if (form.method !== value) animateLayout();
              set({ method: value });
            }} scaleTo={0.98} accessibilityState={{ selected: active }}>
              <Icon size={24} color={active ? colors.primary : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodLabel, active && { color: colors.primary }]}>{label}</Text>
                <Text style={styles.methodHint}>{hint}</Text>
              </View>
              <View style={[styles.radio, active && styles.radioActive]}>{active && (
                <Pop from={0.2}>
                  <View style={styles.radioDot} />
                </Pop>
              )}</View>
            </Tap>
          );
        })}
      </View>

      {form.method === "PICKUP" && (
        <Field label="Where and when to meet" optional value={form.pickupNote} onChangeText={(t) => set({ pickupNote: t })} placeholder="e.g. Male' ferry terminal, 5pm" maxLength={200} />
      )}

      {form.method === "FERRY" && (
        <>
          <Field label="Boat name" value={form.boatName} onChangeText={(t) => set({ boatName: t })} placeholder="e.g. Dhoni Express 2" maxLength={80} />
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>When does it leave?</Text>
          <View style={styles.chipRow}>
            {days.map((d) => (
              <Tap key={d.iso} style={[styles.chip, form.day === d.iso && styles.chipActive]} onPress={() => set({ day: d.iso })} scaleTo={0.94}>
                <Text style={[styles.chipText, form.day === d.iso && styles.chipTextActive]}>{d.label}</Text>
              </Tap>
            ))}
          </View>
          <View style={styles.timeRow}>
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={form.time}
              onChangeText={onTime}
              placeholder="2:30"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={5}
              accessibilityLabel="Departure time"
            />
            {(["AM", "PM"] as const).map((p) => {
              const active = form.pm === (p === "PM");
              return (
                <Tap key={p} style={[styles.chip, styles.ampm, active && styles.chipActive]} onPress={() => set({ pm: p === "PM" })} scaleTo={0.94}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{p}</Text>
                </Tap>
              );
            })}
          </View>
          <Field label="Cargo number" optional value={form.cargoReference} onChangeText={(t) => set({ cargoReference: t })} placeholder="From your cargo receipt" maxLength={40} />
        </>
      )}

      {form.method === "COURIER" && (
        <Field label="Courier or driver's name" value={form.courierName} onChangeText={(t) => set({ courierName: t })} placeholder="e.g. Ahmed, Maldives Post" maxLength={80} />
      )}

      {!!missing && (form.boatName || form.time || form.courierName) ? <Text style={styles.hint}>{missing}</Text> : null}
      <BigButton label={form.method === "PICKUP" ? "It's ready to collect" : "I've sent it"} onPress={send} busy={busy} disabled={!!missing} />
    </Card>
  );
}

function DeliveryDetails({ order }: { order: Order }) {
  const styles = useStyles();
  const rows: Array<[string, string]> = [];
  if (order.deliveryMethod === "FERRY") {
    if (order.boatName) rows.push(["Boat", order.boatName]);
    if (order.boatDeparture) rows.push(["Leaves", formatWhen(order.boatDeparture)]);
    if (order.cargoReference) rows.push(["Cargo number", order.cargoReference]);
  } else if (order.deliveryMethod === "COURIER") {
    if (order.courierName) rows.push(["Courier", order.courierName]);
  } else if (order.pickupNote) {
    rows.push(["Meet", order.pickupNote]);
  }
  if (!rows.length) return null;
  return (
    <View style={styles.details}>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.detailRow}>
          <Text style={styles.detailKey}>{k}</Text>
          <Text style={styles.detailValue}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function BuyerOnTheWay({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const styles = useStyles();
  const showAlert = useAppAlert();
  const { user } = useAuth();
  const toast = useToast();
  const [shared, setShared] = useState(false);
  const pickup = order.deliveryMethod === "PICKUP";
  const title = order.deliveryMethod === "FERRY" ? "Your item is on the ferry" : order.deliveryMethod === "COURIER" ? "Your item is on its way" : "Your item is ready to collect";

  const [share, busy] = useSingleFlight(async () => {
    if (!user) return;
    setShared(true);
    try {
      await api.shareHandoverCode(order.id, user.id);
      toast.success(`Code sent. ${order.seller.name} will finish the delivery.`);
    } catch (e) {
      setShared(false);
      toast.error(errorMessage(e, "Couldn't send the code. Please try again."));
    }
  });

  return (
    <>
      <Card icon={order.deliveryMethod === "FERRY" ? Ship : order.deliveryMethod === "COURIER" ? Truck : Handshake} title={title}>
        <DeliveryDetails order={order} />
        {!pickup && (
          <>
            <Text style={styles.cardText}>Once the item is in your hands, tap the button below. This sends your code to {order.seller.name}.</Text>
            <BigButton
              label={shared ? "Code sent" : "I've got the item"}
              tone="success"
              busy={busy}
              disabled={shared}
              onPress={() =>
                showAlert({
                  title: "Do you have the item?",
                  message: "Only say yes if the item is in your hands. This tells the seller the delivery is done.",
                  kind: "info",
                  buttons: [
                    { text: "Not yet", style: "cancel" },
                    { text: "Yes, I have it", onPress: share },
                  ],
                })
              }
            />
          </>
        )}
      </Card>
      <CodeCard order={order} onChange={onChange} />
    </>
  );
}

// The buyer's secret code, with a plain explanation of what it's for.
function CodeCard({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const locked = order.codeAttempts >= MAX_CODE_ATTEMPTS;
  const [renew, busy] = useSingleFlight(async () => {
    if (!user) return;
    try {
      onChange(await api.newHandoverCode(order.id, user.id));
      toast.success("Here's your new code.");
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't make a new code."));
    }
  });
  const pickup = order.deliveryMethod === "PICKUP";
  return (
    <View style={[styles.card, styles.codeCard]}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIcon, { backgroundColor: `${colors.gold}22` }]}>
          <KeyRound size={22} color={colors.gold} />
        </View>
        <Text style={styles.cardTitle}>Your secret code</Text>
      </View>
      <View style={styles.codeDigits}>
        {(order.handoverCode ?? "····").split("").map((d, i) => (
          <Pop key={`${order.handoverCode}-${i}`} delay={200 + i * 90} from={0.5}>
            <View style={styles.codeDigit}>
              <Text style={styles.codeDigitText}>{d}</Text>
            </View>
          </Pop>
        ))}
      </View>
      <Text style={styles.cardText}>
        {pickup && order.status === "DISPATCHED"
          ? `Show this to ${order.seller.name} when you collect the item.`
          : `Only give this code to ${order.seller.name} once the item is in your hands. Never share it before.`}
      </Text>
      {locked && (
        <>
          <Text style={[styles.hint, { color: colors.danger }]}>The seller typed the wrong code too many times. Make a new code and give it to them.</Text>
          <BigButton label="Make a new code" onPress={renew} busy={busy} />
        </>
      )}
      {!locked && (
        <Tap style={styles.textLink} onPress={renew} disabled={busy} scaleTo={0.96}>
          <Text style={styles.textLinkText}>{busy ? "Making a new code..." : "Shared it by mistake? Make a new code"}</Text>
        </Tap>
      )}
    </View>
  );
}

function EnterCodeCard({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const showAlert = useAppAlert();
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const locked = order.codeAttempts >= MAX_CODE_ATTEMPTS;
  const [shakeStyle, shake] = useShake();

  const [confirm, busy] = useSingleFlight(async (value: string) => {
    if (!user || value.length !== CODE_LENGTH) return;
    try {
      const r = await api.confirmDelivery(order.id, user.id, value);
      onChange(r.order);
      if (r.becameVerified) {
        showAlert({ title: "You're now a verified seller", message: "Buyers will see a blue tick on your listings.", kind: "success" });
      } else {
        toast.success("Delivery complete. Well done!");
      }
    } catch (e) {
      setCode("");
      shake();
      toast.error(errorMessage(e, "That code didn't work. Please try again."));
      // Pick up the new attempt count (and a possible lock).
      api.order(order.id, user.id).then(onChange).catch(() => {});
    }
  });

  const onCodeChange = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) confirm(digits);
  };

  const pickup = order.deliveryMethod === "PICKUP";
  return (
    <Card
      icon={KeyRound}
      title={`Ask ${order.buyer.name} for their code`}
      text={
        pickup
          ? `When ${order.buyer.name} collects the item, they'll show you a 4-digit code. Type it here to finish.`
          : `When ${order.buyer.name} gets the item, they'll send you a 4-digit code in the chat. Type it here to finish.`
      }
    >
      <DeliveryDetails order={order} />
      {locked ? (
        <Text style={[styles.hint, { color: colors.danger }]}>Too many wrong codes. Ask {order.buyer.name} to make a new code in their app.</Text>
      ) : (
        <>
          <Animated.View style={shakeStyle}>
          <Tap style={styles.codeDigits} onPress={() => input.current?.focus()} scaleTo={0.99} accessibilityLabel="Enter the buyer's code">
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View key={i} style={[styles.codeDigit, styles.codeEntry, focused && i === code.length && { borderColor: colors.primary }]}>
                {code[i] ? (
                  <Pop key={`${i}-${code[i]}`} from={0.5}>
                    <Text style={styles.codeDigitText}>{code[i]}</Text>
                  </Pop>
                ) : null}
              </View>
            ))}
          </Tap>
          </Animated.View>
          <TextInput
            ref={input}
            value={code}
            onChangeText={onCodeChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            style={styles.hiddenInput}
            textContentType="oneTimeCode"
          />
          <BigButton label="Finish delivery" tone="success" onPress={() => (code.length === CODE_LENGTH ? confirm(code) : input.current?.focus())} busy={busy} />
        </>
      )}
    </Card>
  );
}

function PaymentCard({ order }: { order: Order }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const seller = order.role === "SELLER";
  const bank = order.paymentMethod === "BANK_TRANSFER";
  const how = order.paymentMethod ? (bank ? "bank transfer" : "cash") : null;
  const text = seller
    ? how
      ? `${order.buyer.name} pays you ${formatMvr(order.amount)} by ${how}.`
      : `Agree with ${order.buyer.name} how they'll pay you ${formatMvr(order.amount)}.`
    : how
    ? `Pay ${order.seller.name} ${formatMvr(order.amount)} by ${how}.${bank ? " Ask for their account details in the chat." : ""}`
    : `Agree with ${order.seller.name} in the chat how to pay ${formatMvr(order.amount)}.`;
  const Icon = bank ? Landmark : Banknote;
  return (
    <View style={styles.payment}>
      <Icon size={20} color={colors.textMuted} />
      <Text style={styles.paymentText}>{text}</Text>
    </View>
  );
}

function ProblemSheet({ visible, onClose, order, onChange }: { visible: boolean; onClose: () => void; order: Order; onChange: (o: Order) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [text, setText] = usePersistentState(`${DRAFT_PREFIX}problem.${order.id}`, { value: "" });
  const ok = text.value.trim().length >= 5;
  const [submit, busy] = useSingleFlight(async () => {
    if (!user || !ok) return;
    try {
      onChange(await api.reportOrderProblem(order.id, user.id, text.value.trim()));
      setText({ value: "" });
      onClose();
      toast.success(`Thanks. ${order.seller.name} has been told.`);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't send that. Please try again."));
    }
  });
  return (
    <Sheet visible={visible} onClose={onClose} title="What went wrong?">
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={text.value}
          onChangeText={(v) => setText({ value: v })}
          placeholder="e.g. The item never arrived, or it's broken"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          autoFocus
        />
        <BigButton label="Send report" onPress={submit} busy={busy} disabled={!ok} />
      </View>
    </Sheet>
  );
}

function OrderSkeleton() {
  return (
    <SkeletonGroup>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        <Skeleton width={72} height={72} rounded={radius.md} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="40%" height={14} />
        </View>
      </View>
      <Skeleton width="100%" height={56} rounded={radius.md} style={{ marginTop: spacing.lg }} />
      <Skeleton width="100%" height={220} rounded={radius.lg} style={{ marginTop: spacing.md }} />
    </SkeletonGroup>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: spacing.sm, gap: spacing.md },
  desktopColumn: { maxWidth: 560, width: "100%", alignSelf: "center", paddingTop: spacing.lg },

  itemCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow },
  itemThumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.skeleton },
  itemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  itemPrice: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.price, marginTop: 2 },
  itemMeta: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },

  steps: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing.xs },
  step: { alignItems: "center", width: 76, zIndex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted },
  stepLabel: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 6, textAlign: "center" },
  stepLine: { flex: 1, height: 2, marginTop: 13, marginHorizontal: -22, borderRadius: 1 },

  card: { padding: spacing.md + 4, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow },
  celebrate: { alignItems: "center", paddingTop: spacing.lg + 4 },
  celebrateTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.md + 4, textAlign: "center" },
  codeCard: { borderWidth: 1, borderColor: `${colors.gold}55` },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, lineHeight: fontSize.lg * 1.3 },
  cardText: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: fontSize.md * 1.45, marginTop: spacing.sm + 4 },

  bigButton: { height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  bigButtonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  method: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  methodActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  methodLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  methodHint: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  stepHeading: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.md + 4, marginBottom: spacing.sm + 2 },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.primaryLight, paddingLeft: spacing.sm + 4, paddingVertical: 2 },
  quoteText: { fontSize: fontSize.base, color: colors.text, lineHeight: fontSize.base * 1.45, fontStyle: "italic" },
  secondaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 50, borderRadius: radius.pill, backgroundColor: colors.primaryTint, marginTop: spacing.sm + 4 },
  secondaryButtonText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  doneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  doneText: { flex: 1, fontSize: fontSize.base, color: colors.text },
  callRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, marginTop: spacing.sm + 4 },
  callText: { fontSize: fontSize.base, color: colors.textMuted },
  fieldLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  optional: { fontWeight: fontWeight.regular, color: colors.textMuted },
  input: { height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  textArea: { height: 120, paddingTop: spacing.sm + 4, textAlignVertical: "top" },
  hint: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm + 4, lineHeight: fontSize.sm * 1.4 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 44, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  chipText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  chipTextActive: { color: colors.primary },
  timeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm + 4, alignItems: "center" },
  timeInput: { width: 110, fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: "center" },
  ampm: { width: 64 },

  details: { marginTop: spacing.md, borderRadius: radius.md, backgroundColor: colors.background, padding: spacing.md, gap: spacing.sm },
  detailRow: { flexDirection: "row", gap: spacing.md },
  detailKey: { width: 104, fontSize: fontSize.base, color: colors.textMuted },
  detailValue: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },

  codeDigits: { flexDirection: "row", justifyContent: "center", gap: spacing.sm + 4, marginTop: spacing.md + 4 },
  codeDigit: { width: 58, height: 68, borderRadius: radius.md, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  codeEntry: { borderWidth: 2, borderColor: colors.border },
  codeDigitText: { fontSize: 32, fontWeight: fontWeight.extrabold, color: colors.text, letterSpacing: 1 },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },

  payment: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primaryTint },
  paymentText: { flex: 1, fontSize: fontSize.base, color: colors.text, lineHeight: fontSize.base * 1.4 },

  chatButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.primary },
  chatButtonText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  textLink: { alignSelf: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  textLinkText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textMuted, textDecorationLine: "underline" },
}));
