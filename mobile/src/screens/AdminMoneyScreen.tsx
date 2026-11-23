import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { CheckCircle2, AlertTriangle, Landmark, Tag, Inbox, Clock, Play, ExternalLink, Receipt, Save, CreditCard } from "lucide-react-native";
import { api, CardStatus, errorMessage, mediaUrl, MoneySettings, PlanPrices, Purchase, SellerPlanPrices } from "../api/client";
import { useToast } from "../components/Toast";
import { useAppAlert } from "../components/AppAlertProvider";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { RowSkeleton } from "../components/Skeleton";
import { animateLayout } from "../components/Motion";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { formatPhone } from "../utils/phone";
import StaffOnly from "../components/StaffOnly";
import { useConsoleColumn, useConsolePage } from "../console/layout";
import MediaViewer from "../components/MediaViewer";

const KIND_LABEL = { BOOST: "Boost", AD: "Ad", BUY_FOR_YOU: "Buy for you", STORE_PLAN: "Store plan", PREMIUM_PLAN: "Premium plan" } as const;
const PLANS: Array<keyof PlanPrices> = ["3", "7", "30"];
type Tab = "QUEUE" | "BANK" | "PRICES";
type Filter = "NEEDS" | "WAITING" | "RUNNING" | "ALL";
const needsYou = (p: Purchase) => p.status === "SUBMITTED" || p.status === "REQUESTED" || (p.status === "ACTIVE" && p.kind === "BUY_FOR_YOU");
const num = (v: string) => Number(v.replace(/\D/g, "")) || 0;

// Admins: purchases to check, the bank details customers pay into, and every
// price. Nothing goes live until a payment is approved here.
function AdminMoneyScreenInner() {
  // A photo (slip, receipt) opened here, not in a new tab.
  const [viewing, setViewing] = useState<string | null>(null);
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { isDesktopWeb, gutter } = useResponsive();
  const { width } = useWindowDimensions();
  const page = useConsolePage();
  const column = useConsoleColumn();
  const [settings, setSettings] = useState<MoneySettings | null>(null);
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [totals, setTotals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("QUEUE");
  const [filter, setFilter] = useState<Filter>("NEEDS");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [card, setCard] = useState<CardStatus | null>(null);
  const [toggling, setToggling] = useState(false);
  const toggleTestMode = async (on: boolean) => {
    setToggling(true);
    try {
      setCard(await api.setCardTestMode(on));
      toast.success(on ? "Card test mode is on for 24 hours." : "Card test mode is off.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setToggling(false);
    }
  };
  // Two queue cards side by side once there's room (sidebar included).
  const twoColumns = width >= 1180;

  const load = useCallback(
    () =>
      api
        .adminMoney()
        .then((res) => {
          setSettings(res.settings);
          setCard(res.cardPayments ?? null);
          setPurchases(res.purchases);
          setLoadError(null);
        })
        .catch((e) => setLoadError(errorMessage(e, "Couldn't load payments. Please try again."))),
    []
  );
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const [save, saving] = useSingleFlight(async () => {
    if (!settings) return;
    try {
      setSettings(await api.saveMoneySettings(settings));
      toast.success("Saved.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const [act, acting] = useSingleFlight(async (p: Purchase, body: Parameters<typeof api.purchaseAction>[1], done: string) => {
    try {
      await api.purchaseAction(p.id, body);
      toast.success(done);
      animateLayout();
      setRejecting(null);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const confirmApprove = (p: Purchase) =>
    showAlert({
      title: `Is MVR ${p.amount.toLocaleString()} in the bank?`,
      message: `Check your bank for reference ${p.reference}. A slip alone doesn't prove the money arrived.`,
      kind: "info",
      buttons: [{ text: "Not yet", style: "cancel" }, { text: "Yes, approve", onPress: () => act(p, { action: "APPROVE" }, "Approved.") }],
    });

  const reject = (p: Purchase) => {
    const note = notes[p.id]?.trim();
    if (!note || note.length < 3) return toast.error("Write the reason the customer will see.");
    act(p, { action: "REJECT", note }, "Sent to the customer.");
  };

  const counts = useMemo(() => {
    const list = purchases ?? [];
    return {
      NEEDS: list.filter(needsYou).length,
      WAITING: list.filter((p) => p.status === "AWAITING_PAYMENT").length,
      RUNNING: list.filter((p) => p.status === "ACTIVE" && p.kind !== "BUY_FOR_YOU").length,
      ALL: list.length,
    };
  }, [purchases]);
  const shown = (purchases ?? []).filter((p) =>
    filter === "NEEDS" ? needsYou(p) : filter === "WAITING" ? p.status === "AWAITING_PAYMENT" : filter === "RUNNING" ? p.status === "ACTIVE" && p.kind !== "BUY_FOR_YOU" : true
  );

  // ---- pieces (render functions, not components, so inputs keep focus) -------

  const moneyInput = (value: string, onChange: (v: string) => void, label: string, suffix?: string) => (
    <View style={styles.moneyField}>
      {!suffix && <Text style={styles.moneyPrefix}>MVR</Text>}
      <TextInput style={styles.moneyInput} value={value} onChangeText={onChange} keyboardType="number-pad" accessibilityLabel={label} placeholderTextColor={colors.textMuted} />
      {!!suffix && <Text style={styles.moneyPrefix}>{suffix}</Text>}
    </View>
  );
  const priceCell = (label: string, value: number, onChange: (v: number) => void, suffix?: string) => (
    <View key={label} style={styles.priceCell}>
      <Text style={styles.priceLabel}>{label}</Text>
      {moneyInput(String(value ?? 0), (v) => onChange(num(v)), label, suffix)}
    </View>
  );
  const priceGroup = (title: string, help: string, cells: React.ReactNode[]) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardHelp}>{help}</Text>
      <View style={styles.priceGrid}>{cells}</View>
    </View>
  );
  const saveBar = (
    <Tap style={styles.saveButton} onPress={() => save()} disabled={saving} scaleTo={0.97}>
      {saving ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Save size={17} color="#fff" />
          <Text style={styles.saveText}>Save changes</Text>
        </>
      )}
    </Tap>
  );
  const setPlan = (group: "boostPrices" | "adPrices", plan: keyof PlanPrices) => (v: number) => setSettings((s) => (s ? { ...s, [group]: { ...s[group], [plan]: v } } : s));
  const setSellerPlan = (k: keyof SellerPlanPrices) => (v: number) => setSettings((s) => (s ? { ...s, sellerPlans: { ...s.sellerPlans, [k]: v } } : s));

  const status = (p: Purchase) => {
    if (p.status === "SUBMITTED") return { label: "Slip sent: check the bank", color: colors.primary };
    if (p.status === "REQUESTED") return { label: "Check the seller still has it", color: colors.gold };
    if (p.status === "AWAITING_PAYMENT") return { label: "Waiting for payment", color: colors.textMuted };
    if (p.status === "ACTIVE") return p.kind === "BUY_FOR_YOU" ? { label: "Paid: deliver it", color: colors.primary } : { label: "Running", color: colors.success };
    return { label: p.status.toLowerCase(), color: colors.textMuted };
  };

  const renderPurchase = (p: Purchase) => {
    const st = status(p);
    const isRejecting = rejecting === p.id;
    return (
      <View key={p.id} style={[styles.purchase, twoColumns && styles.purchaseHalf]}>
        <View style={styles.purchaseHead}>
          <View style={styles.kindPill}>
            <Text style={styles.kindText}>{KIND_LABEL[p.kind]}</Text>
          </View>
          {p.note?.startsWith("Test card payment") && (
            <View style={[styles.kindPill, { backgroundColor: "#7B5CF522" }]}>
              <Text style={[styles.kindText, { color: "#7B5CF5" }]}>TEST</Text>
            </View>
          )}
          <Text style={styles.reference} selectable numberOfLines={1}>
            {p.reference}
          </Text>
          <Text style={styles.amount}>MVR {p.amount.toLocaleString()}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {p.itemTitle ?? p.adTitle ?? KIND_LABEL[p.kind]}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {p.user?.name} · {formatPhone(p.user?.phone) || p.user?.email}
          {p.days ? ` · ${p.days} days` : ""}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: `${st.color}18` }]}>
          <View style={[styles.statusDot, { backgroundColor: st.color }]} />
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
        {!!p.itemPrice && <Text style={styles.meta}>Seller's price: MVR {p.itemPrice.toLocaleString()} (customers don't see this)</Text>}
        {!!p.deliveryNote && (
          <Text style={styles.meta}>
            Deliver to: {p.deliveryNote} · Call {p.contactPhone}
          </Text>
        )}
        {!!p.adImage && p.kind === "AD" && <Image source={{ uri: mediaUrl(p.adImage) }} style={styles.adImage} resizeMode="cover" />}
        {!!p.adUrl && <Text style={styles.meta}>Leads to: {p.adUrl}</Text>}
        {p.status === "ACTIVE" && p.kind === "AD" && (
          <Text style={styles.meta}>
            {p.impressions} views · {p.clicks} taps
          </Text>
        )}
        {(!!p.slipUrl || !!p.itemUrl) && (
          <View style={styles.links}>
            {!!p.slipUrl && (
              <Tap style={styles.link} onPress={() => setViewing(mediaUrl(p.slipUrl) ?? null)} scaleTo={0.96}>
                <Receipt size={14} color={colors.primary} />
                <Text style={styles.linkText}>Payment slip</Text>
              </Tap>
            )}
            {!!p.itemUrl && (
              <Tap style={styles.link} onPress={() => Linking.openURL(p.itemUrl!).catch(() => {})} scaleTo={0.96}>
                <ExternalLink size={14} color={colors.primary} />
                <Text style={styles.linkText}>Open on iBay</Text>
              </Tap>
            )}
          </View>
        )}

        {p.status === "REQUESTED" && (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Final total with delivery</Text>
            {moneyInput(totals[p.id] ?? (p.amount ? String(p.amount) : ""), (t) => setTotals((x) => ({ ...x, [p.id]: t.replace(/\D/g, "") })), "Final total")}
          </View>
        )}

        {isRejecting ? (
          <View style={{ gap: spacing.sm }}>
            <TextInput style={styles.input} value={notes[p.id] ?? ""} onChangeText={(t) => setNotes((x) => ({ ...x, [p.id]: t }))} placeholder="Reason the customer will see" placeholderTextColor={colors.textMuted} accessibilityLabel="Reason for turning this down" maxLength={200} autoFocus />
            {(p.status === "ACTIVE" || p.status === "SUBMITTED") && <Text style={styles.small}>If they've paid, refund them yourself.</Text>}
            <View style={styles.actions}>
              <Tap style={[styles.actionButton, styles.secondary]} onPress={() => setRejecting(null)} scaleTo={0.97}>
                <Text style={[styles.actionText, { color: colors.text }]}>Back</Text>
              </Tap>
              <Tap style={[styles.actionButton, { backgroundColor: colors.danger }]} disabled={acting} onPress={() => reject(p)} scaleTo={0.97}>
                <Text style={styles.actionText}>Turn down</Text>
              </Tap>
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <Tap style={[styles.actionButton, styles.secondary]} onPress={() => setRejecting(p.id)} scaleTo={0.97}>
              <Text style={[styles.actionText, { color: colors.danger }]}>Turn down</Text>
            </Tap>
            {p.status === "SUBMITTED" && (
              <Tap style={[styles.actionButton, { backgroundColor: colors.success }]} disabled={acting} onPress={() => confirmApprove(p)} scaleTo={0.97}>
                <Text style={styles.actionText}>Approve payment</Text>
              </Tap>
            )}
            {p.status === "REQUESTED" && (
              <Tap style={styles.actionButton} disabled={acting} onPress={() => act(p, { action: "QUOTE", amount: Number(totals[p.id] ?? p.amount) }, "Sent to the buyer.")} scaleTo={0.97}>
                <Text style={styles.actionText}>Available: ask to pay</Text>
              </Tap>
            )}
            {p.status === "ACTIVE" && p.kind === "BUY_FOR_YOU" && (
              <Tap style={styles.actionButton} disabled={acting} onPress={() => act(p, { action: "COMPLETE" }, "Marked as delivered.")} scaleTo={0.97}>
                <Text style={styles.actionText}>Mark as delivered</Text>
              </Tap>
            )}
          </View>
        )}
      </View>
    );
  };

  // ---- layout ---------------------------------------------------------------

  if (loadError && (!settings || !purchases)) {
    return (
      <View style={styles.center}>
        <EmptyState icon={AlertTriangle} tone="error" title="Payments didn't load" message={loadError} actionLabel="Try again" onAction={() => (setLoadError(null), load())} />
      </View>
    );
  }
  if (!settings || !purchases) {
    return (
      <View style={styles.center}>
        <View style={[{ width: "100%", maxWidth: contentWidth.list, paddingHorizontal: gutter }, column]}>
          <RowSkeleton count={5} />
        </View>
      </View>
    );
  }

  const tabs: Array<[Tab, string, typeof Inbox, number | null]> = [
    ["QUEUE", "To check", Inbox, counts.NEEDS],
    ["BANK", "Bank details", Landmark, null],
    ["PRICES", "Prices", Tag, null],
  ];

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Payments and prices" />}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }, page]} keyboardShouldPersistTaps="handled">
          {/* At a glance */}
          <View style={styles.stats}>
            {(
              [
                ["Needs you", counts.NEEDS, Inbox, colors.primary, "NEEDS"],
                ["Waiting for payment", counts.WAITING, Clock, colors.gold, "WAITING"],
                ["Running now", counts.RUNNING, Play, colors.success, "RUNNING"],
              ] as const
            ).map(([label, n, Icon, tint, f]) => (
              <Tap key={label} style={styles.stat} onPress={() => (setTab("QUEUE"), setFilter(f))} scaleTo={0.98}>
                <View style={[styles.statIcon, { backgroundColor: `${tint}1A` }]}>
                  <Icon size={18} color={tint} />
                </View>
                <View>
                  <Text style={styles.statValue}>{n}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              </Tap>
            ))}
          </View>

          {!settings.accountNumber && (
            <Tap style={styles.warning} onPress={() => setTab("BANK")} scaleTo={0.99}>
              <AlertTriangle size={18} color={colors.gold} />
              <Text style={styles.warningText}>Alibe can't take payments until your bank details are filled in.</Text>
            </Tap>
          )}

          <View style={styles.tabs}>
            {tabs.map(([key, label, Icon, n]) => {
              const on = tab === key;
              return (
                <Tap key={key} style={[styles.tab, on && styles.tabOn]} onPress={() => setTab(key)} scaleTo={0.97} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                  <Icon size={16} color={on ? colors.inverseText : colors.textMuted} />
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
                  {!!n && (
                    <View style={styles.tabCount}>
                      <Text style={styles.tabCountText}>{n}</Text>
                    </View>
                  )}
                </Tap>
              );
            })}
          </View>

          {tab === "QUEUE" && (
            <>
              <View style={styles.filters}>
                {(
                  [
                    ["NEEDS", "Needs you"],
                    ["WAITING", "Waiting for payment"],
                    ["RUNNING", "Running"],
                    ["ALL", "All"],
                  ] as const
                ).map(([key, label]) => {
                  const on = filter === key;
                  return (
                    <Tap key={key} style={[styles.chip, on && styles.chipOn]} onPress={() => setFilter(key)} scaleTo={0.95}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {label} {counts[key]}
                      </Text>
                    </Tap>
                  );
                })}
              </View>
              {shown.length ? (
                <View style={styles.grid}>{shown.map(renderPurchase)}</View>
              ) : (
                <EmptyState compact icon={CheckCircle2} title={filter === "NEEDS" ? "All caught up" : "Nothing here"} message={filter === "NEEDS" ? "New slips and requests appear here." : "Try another filter."} />
              )}
            </>
          )}

          {tab === "BANK" && (
            <View style={{ gap: spacing.md }}>
            {/* Card payments (BML Connect): honest about whether it works. */}
            <View style={[styles.card, styles.formCard, { borderWidth: 1.5, borderColor: card?.enabled ? `${colors.success}55` : colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <CreditCard size={20} color={card?.enabled ? colors.success : colors.textMuted} />
                <Text style={[styles.cardTitle, { flex: 1 }]}>Card payments (BML)</Text>
                <View style={[styles.statusPill, { backgroundColor: card?.enabled ? `${colors.success}18` : `${colors.textMuted}18` }]}>
                  <Text style={[styles.statusText, { color: card?.enabled ? colors.success : colors.textMuted }]}>{card?.mode === "live" ? "Live" : card?.mode === "simulated" ? "Test mode" : "Not set up"}</Text>
                </View>
              </View>
              {card?.mode === "live" ? (
                <Text style={styles.cardHelp}>
                  Live with your BML key{card.liveMode === "sandbox" ? " (BML's sandbox)" : ""}. Buyers see "Pay by card" and payments start as soon as BML confirms them. Not tested against BML yet: try a small payment and check it here first.
                </Text>
              ) : card?.mode === "simulated" ? (
                <>
                  <Text style={styles.cardHelp}>
                    Test mode until {card.simulatedUntil ? new Date(card.simulatedUntil).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "soon"}. Buyers see "Pay by card (test)" and a pretend checkout: the whole flow works, but no money moves. Anything paid this way starts for free and is marked TEST below, so only keep it on while you're trying it out.
                  </Text>
                  <Tap style={[styles.actionButton, styles.secondary, { alignSelf: "flex-start", maxWidth: 260 }]} onPress={() => toggleTestMode(false)} disabled={toggling} scaleTo={0.97}>
                    <Text style={[styles.actionText, { color: colors.danger }]}>Turn test mode off</Text>
                  </Tap>
                </>
              ) : (
                <>
                  <Text style={styles.cardHelp}>
                    Off, so buyers only see bank transfer. Card payments need an API key from BML's merchant portal (add BML_API_KEY to the server's .env and deploy). Until then you can try the whole flow in test mode: a pretend checkout, no money moves, switches itself off after 24 hours.
                  </Text>
                  <Tap style={[styles.actionButton, { alignSelf: "flex-start", maxWidth: 300, backgroundColor: "#7B5CF5" }]} onPress={() => toggleTestMode(true)} disabled={toggling} scaleTo={0.97}>
                    {toggling ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Try it: turn on test mode (24 h)</Text>}
                  </Tap>
                </>
              )}
            </View>
            <View style={[styles.card, styles.formCard]}>
              <Text style={styles.cardTitle}>Where customers pay</Text>
              <Text style={styles.cardHelp}>Shown on every payment screen. Check it carefully: money sent to a wrong account is hard to get back.</Text>
              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Bank</Text>
                  <TextInput style={styles.input} value={settings.bankName} onChangeText={(bankName) => setSettings({ ...settings, bankName })} placeholder="e.g. BML" placeholderTextColor={colors.textMuted} accessibilityLabel="Bank" />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Account name</Text>
                  <TextInput style={styles.input} value={settings.accountName} onChangeText={(accountName) => setSettings({ ...settings, accountName })} placeholder="Alibe Pvt Ltd" placeholderTextColor={colors.textMuted} accessibilityLabel="Account name" />
                </View>
              </View>
              <View>
                <Text style={styles.label}>Account number</Text>
                <TextInput style={[styles.input, styles.mono]} value={settings.accountNumber} onChangeText={(accountNumber) => setSettings({ ...settings, accountNumber })} keyboardType="number-pad" placeholder="7730000000000" placeholderTextColor={colors.textMuted} accessibilityLabel="Account number" />
              </View>
              {saveBar}
            </View>
            </View>
          )}

          {tab === "PRICES" && (
            <View style={{ gap: spacing.md }}>
              <View style={[styles.twoCol, !twoColumns && { flexDirection: "column" }]}>
                <View style={twoColumns ? styles.col : undefined}>{priceGroup("Boosts", "An item at the top of search and the home page.", PLANS.map((d) => priceCell(`${d} days`, settings.boostPrices[d], setPlan("boostPrices", d))))}</View>
                <View style={twoColumns ? styles.col : undefined}>{priceGroup("Home page ads", 'A banner with an "Ad" label.', PLANS.map((d) => priceCell(`${d} days`, settings.adPrices[d], setPlan("adPrices", d))))}</View>
              </View>
              {priceGroup("Seller plans", "A store with Premium pays both the Store and Premium price; individuals pay only Premium.", [
                priceCell("Store, a month", settings.sellerPlans.storeMonthly, setSellerPlan("storeMonthly")),
                priceCell("Store, a year", settings.sellerPlans.storeYearly, setSellerPlan("storeYearly")),
                priceCell("Premium, a month", settings.sellerPlans.premiumMonthly, setSellerPlan("premiumMonthly")),
                priceCell("Premium, a year", settings.sellerPlans.premiumYearly, setSellerPlan("premiumYearly")),
                priceCell("Free boosts a month", settings.premiumFreeBoosts, (v) => setSettings({ ...settings, premiumFreeBoosts: Math.min(30, v) }), "boosts"),
              ])}
              {priceGroup("Buy through Alibe (iBay items)", "Added to the seller's price. Customers only see the total.", [
                priceCell("Markup", settings.feePercent, (v) => setSettings({ ...settings, feePercent: Math.min(100, v) }), "%"),
                priceCell("At least", settings.feeMinimum, (v) => setSettings({ ...settings, feeMinimum: v })),
              ])}
              {saveBar}
            </View>
          )}
        </ScrollView>
      <MediaViewer uri={viewing} type="IMAGE" onClose={() => setViewing(null)} />
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.background },
  scroll: { paddingVertical: spacing.lg, gap: spacing.md, width: "100%", maxWidth: contentWidth.list, alignSelf: "center" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 4 },
  stat: { flexGrow: 1, flexBasis: 170, flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  statLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textMuted },
  warning: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm + 4, borderRadius: radius.md, backgroundColor: `${colors.gold}1A` },
  warningText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  tabs: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4, padding: 4, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignSelf: "center", maxWidth: "100%" },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.md },
  tabOn: { backgroundColor: colors.text },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted },
  tabTextOn: { color: colors.inverseText },
  tabCount: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  tabCountText: { fontSize: fontSize.micro, fontWeight: fontWeight.extrabold, color: "#fff" },
  filters: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm },
  chip: { paddingHorizontal: 14, height: 34, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  chipTextOn: { color: colors.primary, fontWeight: fontWeight.bold },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  purchase: { width: "100%", backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 2, gap: spacing.sm, ...cardShadow },
  purchaseHalf: { width: "auto", flexBasis: 380, flexGrow: 1, flexShrink: 1 },
  purchaseHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  kindPill: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: colors.primaryTint, justifyContent: "center" },
  kindText: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: colors.primary },
  reference: { flex: 1, minWidth: 0, fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textMuted, letterSpacing: 0.5 },
  amount: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 19 },
  small: { fontSize: fontSize.caption, color: colors.textMuted },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, height: 26, borderRadius: 13 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
  adImage: { width: "100%", aspectRatio: 2.4, borderRadius: radius.md },
  links: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  link: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: colors.primaryTint },
  linkText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "flex-end", marginTop: spacing.xs },
  actionButton: { flexGrow: 1, minWidth: 130, maxWidth: 260, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  secondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  actionText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.sm, ...cardShadow },
  formCard: { width: "100%", maxWidth: contentWidth.form + 80, alignSelf: "center" },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  cardHelp: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.xs },
  fieldRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  field: { flexGrow: 1, flexBasis: 200 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 6 },
  input: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  mono: { letterSpacing: 1, fontWeight: fontWeight.semibold },
  twoCol: { flexDirection: "row", gap: spacing.md },
  col: { flex: 1, minWidth: 0 },
  priceGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 4 },
  priceCell: { flexGrow: 1, flexBasis: 130, gap: 6 },
  priceLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  moneyField: { flexDirection: "row", alignItems: "center", height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.sm + 4, gap: 6 },
  moneyPrefix: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted },
  moneyInput: { flex: 1, minWidth: 0, height: "100%", fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, outlineStyle: "none" as any },
  saveButton: { flexDirection: "row", gap: spacing.sm, height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", alignSelf: "center", width: "100%", maxWidth: 360, marginTop: spacing.sm },
  saveText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
}));

export default function AdminMoneyScreen() {
  return (
    <StaffOnly title="Payments and prices">
      <AdminMoneyScreenInner />
    </StaffOnly>
  );
}
