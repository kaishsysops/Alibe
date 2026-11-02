import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { CheckCircle2 } from "lucide-react-native";
import { api, errorMessage, mediaUrl, MoneySettings, PlanPrices, Purchase } from "../api/client";
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

const KIND_LABEL = { BOOST: "Boost", AD: "Ad", BUY_FOR_YOU: "Buy for you" } as const;
const PLANS: Array<keyof PlanPrices> = ["3", "7", "30"];

// Staff only: the bank details and prices customers see, and the queue of
// purchases to check. Nothing goes live until it's approved here.
export default function AdminMoneyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { isDesktopWeb, gutter } = useResponsive();
  const [settings, setSettings] = useState<MoneySettings | null>(null);
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [totals, setTotals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(
    () =>
      api
        .adminMoney()
        .then((res) => {
          setSettings(res.settings);
          setPurchases(res.purchases);
        })
        .catch((e) => toast.error(errorMessage(e))),
    [toast]
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

  const setPrice = (group: "boostPrices" | "adPrices", plan: keyof PlanPrices, value: string) =>
    setSettings((s) => (s ? { ...s, [group]: { ...s[group], [plan]: Number(value.replace(/\D/g, "")) || 0 } } : s));

  const reject = (p: Purchase) => {
    const note = notes[p.id]?.trim();
    if (!note || note.length < 3) return toast.error("Write the reason the customer will see.");
    act(p, { action: "REJECT", note }, "Sent to the customer.");
  };

  const renderPurchase = (p: Purchase) => (
    <View key={p.id} style={styles.card}>
      <Text style={styles.kind}>
        {KIND_LABEL[p.kind]} · {p.reference}
      </Text>
      <Text style={styles.title} numberOfLines={2}>
        {p.itemTitle ?? p.adTitle}
      </Text>
      <Text style={styles.meta}>
        {p.user?.name} · {formatPhone(p.user?.phone) || p.user?.email} · MVR {p.amount.toLocaleString()}
        {p.days ? ` · ${p.days} days` : ""}
      </Text>
      {!!p.itemPrice && <Text style={styles.meta}>Seller's price: MVR {p.itemPrice.toLocaleString()}. Customers don't see this.</Text>}
      {!!p.deliveryNote && <Text style={styles.meta}>Deliver to: {p.deliveryNote}. Call: {p.contactPhone}</Text>}
      {!!p.adImage && p.kind === "AD" && <Image source={{ uri: mediaUrl(p.adImage) }} style={styles.adImage} resizeMode="cover" />}
      {!!p.adUrl && <Text style={styles.meta}>Leads to: {p.adUrl}</Text>}
      {!!p.itemUrl && (
        <Tap style={styles.inlineLink} onPress={() => Linking.openURL(p.itemUrl!).catch(() => {})}>
          <Text style={[styles.inlineLinkText, { color: colors.primary }]}>Open on iBay and call the seller</Text>
        </Tap>
      )}
      {!!p.slipUrl && (
        <Tap style={styles.inlineLink} onPress={() => Linking.openURL(mediaUrl(p.slipUrl) ?? "").catch(() => {})}>
          <Text style={[styles.inlineLinkText, { color: colors.primary }]}>View payment slip</Text>
        </Tap>
      )}

      {p.status === "REQUESTED" && (
        <>
          <Text style={styles.label}>Final total with delivery (MVR)</Text>
          <TextInput style={styles.input} value={totals[p.id] ?? (p.amount ? String(p.amount) : "")} onChangeText={(t) => setTotals((x) => ({ ...x, [p.id]: t.replace(/\D/g, "") }))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} accessibilityLabel="Final total" />
          <Tap style={styles.button} disabled={acting} onPress={() => act(p, { action: "QUOTE", amount: Number(totals[p.id] ?? p.amount) }, "Sent to the buyer.")} scaleTo={0.97}>
            <Text style={styles.buttonText}>Available: ask buyer to pay</Text>
          </Tap>
        </>
      )}
      {p.status === "AWAITING_PAYMENT" && <Text style={styles.waiting}>Waiting for the customer to pay.</Text>}
      {p.status === "SUBMITTED" && (
        <Tap style={styles.button} disabled={acting} onPress={() => confirmApprove(p)} scaleTo={0.97}>
          <Text style={styles.buttonText}>Approve payment</Text>
        </Tap>
      )}
      {p.status === "ACTIVE" && p.kind === "BUY_FOR_YOU" && (
        <Tap style={styles.button} disabled={acting} onPress={() => act(p, { action: "COMPLETE" }, "Marked as delivered.")} scaleTo={0.97}>
          <Text style={styles.buttonText}>Mark as delivered</Text>
        </Tap>
      )}
      {p.status === "ACTIVE" && p.kind !== "BUY_FOR_YOU" && <Text style={styles.waiting}>Running. {p.kind === "AD" ? `${p.impressions} views, ${p.clicks} taps.` : ""}</Text>}

      <TextInput style={[styles.input, { marginTop: spacing.md }]} value={notes[p.id] ?? ""} onChangeText={(t) => setNotes((x) => ({ ...x, [p.id]: t }))} placeholder="Reason, if you're turning this down" placeholderTextColor={colors.textMuted} accessibilityLabel="Reason for turning this down" maxLength={200} />
      <Tap style={styles.reject} disabled={acting} onPress={() => reject(p)} scaleTo={0.97}>
        <Text style={[styles.rejectText, { color: colors.danger }]}>{p.status === "ACTIVE" || p.status === "SUBMITTED" ? "Turn down (refund them yourself if they paid)" : "Turn down"}</Text>
      </Tap>
    </View>
  );

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Payments and prices" />}
      {!settings || !purchases ? (
        <View style={{ paddingHorizontal: gutter }}>
          <RowSkeleton count={5} />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">
            <Text style={styles.section}>To check</Text>
            {purchases.length ? purchases.map(renderPurchase) : <EmptyState compact icon={CheckCircle2} title="All caught up" message="New purchases appear here." />}

            <Text style={styles.section}>Your bank details</Text>
            {!settings.accountNumber && <Text style={styles.warning}>Alibe won't take any payments until these are filled in.</Text>}
            <View style={styles.card}>
              <Text style={styles.label}>Bank</Text>
              <TextInput style={styles.input} value={settings.bankName} onChangeText={(bankName) => setSettings({ ...settings, bankName })} placeholder="e.g. BML" placeholderTextColor={colors.textMuted} accessibilityLabel="Bank" />
              <Text style={styles.label}>Account name</Text>
              <TextInput style={styles.input} value={settings.accountName} onChangeText={(accountName) => setSettings({ ...settings, accountName })} placeholderTextColor={colors.textMuted} accessibilityLabel="Account name" />
              <Text style={styles.label}>Account number</Text>
              <TextInput style={styles.input} value={settings.accountNumber} onChangeText={(accountNumber) => setSettings({ ...settings, accountNumber })} keyboardType="number-pad" placeholderTextColor={colors.textMuted} accessibilityLabel="Account number" />
            </View>

            <Text style={styles.section}>Prices (MVR)</Text>
            <View style={styles.card}>
              {(
                [
                  ["boostPrices", "Boost"],
                  ["adPrices", "Ad"],
                ] as const
              ).map(([group, name]) => (
                <View key={group}>
                  <Text style={styles.label}>{name}: 3, 7 and 30 days</Text>
                  <View style={styles.priceRow}>
                    {PLANS.map((plan) => (
                      <TextInput key={plan} style={[styles.input, { flex: 1 }]} value={String(settings[group][plan])} onChangeText={(v) => setPrice(group, plan, v)} keyboardType="number-pad" accessibilityLabel={`${name} for ${plan} days`} />
                    ))}
                  </View>
                </View>
              ))}
              <Text style={styles.label}>Added to iBay prices: percent, and the least you'll add. Customers only see the final price.</Text>
              <View style={styles.priceRow}>
                <TextInput style={[styles.input, { flex: 1 }]} value={String(settings.feePercent)} onChangeText={(v) => setSettings({ ...settings, feePercent: Number(v.replace(/\D/g, "")) || 0 })} keyboardType="number-pad" accessibilityLabel="Fee percent" />
                <TextInput style={[styles.input, { flex: 1 }]} value={String(settings.feeMinimum)} onChangeText={(v) => setSettings({ ...settings, feeMinimum: Number(v.replace(/\D/g, "")) || 0 })} keyboardType="number-pad" accessibilityLabel="Minimum fee" />
              </View>
            </View>
            <Tap style={styles.button} onPress={() => save()} disabled={saving} scaleTo={0.97}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save details and prices</Text>}
            </Tap>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingVertical: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm + 4, width: "100%", maxWidth: contentWidth.list, alignSelf: "center" },
  section: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.sm },
  warning: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.gold },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  kind: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.primary },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginTop: 2 },
  meta: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  adImage: { width: "100%", aspectRatio: 2.4, borderRadius: radius.md, marginTop: spacing.sm },
  inlineLink: { paddingTop: spacing.sm },
  inlineLinkText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { minHeight: controlHeight.input, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  priceRow: { flexDirection: "row", gap: spacing.sm },
  waiting: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted, marginTop: spacing.md },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  reject: { alignItems: "center", paddingTop: spacing.sm + 2 },
  rejectText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
}));
