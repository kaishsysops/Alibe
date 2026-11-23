import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Platform, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Megaphone, Wallet, Copy, Check, ImageUp, CreditCard } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { api, BankDetails, errorMessage, Purchase, PurchaseStatus, uploadMedia } from "../api/client";
import { useToast } from "../components/Toast";
import { useAppAlert } from "../components/AppAlertProvider";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { RowSkeleton } from "../components/Skeleton";
import { animateLayout, FadeIn } from "../components/Motion";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";

const KIND_LABEL = { BOOST: "Boost", AD: "Ad", BUY_FOR_YOU: "Buy through Alibe", STORE_PLAN: "Store plan", PREMIUM_PLAN: "Premium plan" } as const;

function statusText(p: Purchase): string {
  const texts: Record<PurchaseStatus, string> = {
    REQUESTED: "We're checking the seller still has it. You don't need to pay yet.",
    AWAITING_PAYMENT: "Ready for your payment.",
    SUBMITTED: "We've got your slip and we're checking the payment.",
    ACTIVE:
      p.kind === "BUY_FOR_YOU"
        ? "Paid. We're getting your item."
        : new Date(p.endsAt ?? 0) > new Date()
        ? `Live until ${new Date(p.endsAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`
        : "Finished.",
    COMPLETED: "All done.",
    REJECTED: p.note ? `Not going ahead: ${p.note}` : "Not going ahead.",
    CANCELLED: "Cancelled.",
  };
  return texts[p.status];
}

// A "Copy" button: puts the value on the clipboard and says so.
function CopyButton({ value, label, big }: { value: string; label: string; big?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(value);
      setDone(true);
      toast.success(`Copied the ${label}.`);
      setTimeout(() => setDone(false), 2000);
    } catch {
      toast.error("Couldn't copy. Please copy it by hand.");
    }
  };
  return (
    <Tap style={[styles.copy, big && styles.copyBig]} onPress={copy} scaleTo={0.94} accessibilityLabel={`Copy the ${label}`}>
      {done ? <Check size={16} color={colors.success} strokeWidth={3} /> : <Copy size={16} color={colors.primary} />}
      <Text style={[styles.copyText, done && { color: colors.success }]}>{done ? "Copied" : "Copy"}</Text>
    </Tap>
  );
}

export default function PurchasesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { isDesktopWeb, gutter } = useResponsive();
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [cardPayments, setCardPayments] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const route = useRoute<any>();

  // Back from BML's card page (?paid=<id>): ask the server to check it.
  const paidId: string | undefined = route.params?.paid;
  useEffect(() => {
    if (!paidId) return;
    api
      .checkCardPayment(paidId)
      .then((r) => {
        if (r.status === "ACTIVE") toast.success("Payment received. It's live now.");
        else toast.info("We haven't had the card payment confirmed yet. If you paid, it'll show here shortly.");
        load();
      })
      .catch((e) => toast.error(errorMessage(e)));
    navigation.setParams({ paid: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidId]);

  const payByCard = async (p: Purchase) => {
    setPaying(p.id);
    try {
      const { url } = await api.payByCard(p.id);
      if (Platform.OS === "web" && typeof window !== "undefined") window.location.href = url;
      else await Linking.openURL(url);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPaying(null);
    }
  };
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      api
        .myPurchases()
        .then((res) => {
          setPurchases(res.purchases);
          setBank(res.bank);
          setCardPayments(!!res.cardPayments);
        })
        .catch((e) => {
          setPurchases((p) => p ?? []);
          toast.error(errorMessage(e));
        }),
    [toast]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const [sendSlip, sending] = useSingleFlight(async (p: Purchase) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return toast.error("Please allow photo access to add your slip.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const { url } = await uploadMedia(asset.uri, asset.mimeType ?? "image/jpeg");
      await api.submitSlip(p.id, url);
      animateLayout();
      setPurchases((list) => list?.map((x) => (x.id === p.id ? { ...x, status: "SUBMITTED", slipUrl: url } : x)) ?? list);
      toast.success("Slip sent. We'll check the payment soon.");
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't send your slip. Please try again."));
    }
  });

  const confirmCancel = (p: Purchase) =>
    showAlert({
      title: "Cancel this?",
      message: "Only cancel if you haven't sent the money.",
      kind: "info",
      buttons: [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel it",
          style: "destructive",
          onPress: () =>
            api
              .cancelPurchase(p.id)
              .then(() => {
                animateLayout();
                setPurchases((list) => list?.map((x) => (x.id === p.id ? { ...x, status: "CANCELLED" } : x)) ?? list);
              })
              .catch((e) => toast.error(errorMessage(e))),
        },
      ],
    });

  const renderItem = ({ item: p, index }: { item: Purchase; index: number }) => (
    <FadeIn delay={Math.min(index, 6) * 50}>
      <View style={styles.card}>
        <Text style={styles.kind}>{KIND_LABEL[p.kind]}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {p.itemTitle ?? p.adTitle}
        </Text>
        <Text style={styles.status}>{statusText(p)}</Text>
        {p.kind === "AD" && p.status === "ACTIVE" && (
          <Text style={styles.stats}>
            {p.impressions.toLocaleString()} views · {p.clicks.toLocaleString()} taps
          </Text>
        )}

        {p.status === "AWAITING_PAYMENT" && (
          <View style={styles.payBox}>
            {cardPayments && (
              <>
                <Tap style={styles.cardButton} onPress={() => payByCard(p)} disabled={paying === p.id} scaleTo={0.97} accessibilityLabel={`Pay MVR ${p.amount} by card`}>
                  {paying === p.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <CreditCard size={20} color="#fff" />
                      <Text style={styles.buttonText}>Pay MVR {p.amount.toLocaleString()} by card</Text>
                    </>
                  )}
                </Tap>
                <Text style={styles.cardNote}>On Bank of Maldives' secure page. It starts as soon as you've paid.</Text>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or pay by bank transfer</Text>
                  <View style={styles.orLine} />
                </View>
              </>
            )}
            {/* 1. Send the money */}
            <View style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>1</Text>
              </View>
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Text style={styles.stepTitle}>Send MVR {p.amount.toLocaleString()} to Alibe</Text>
                <View style={styles.bankCard}>
                  <Text style={styles.bankLabel}>Bank</Text>
                  <Text style={styles.bankValue}>{bank?.bankName}</Text>
                  <Text style={[styles.bankLabel, { marginTop: spacing.sm }]}>Account name</Text>
                  <Text style={styles.bankValue}>{bank?.accountName}</Text>
                  <Text style={[styles.bankLabel, { marginTop: spacing.sm }]}>Account number</Text>
                  <View style={styles.copyRow}>
                    <Text style={[styles.bankValue, styles.mono, { flex: 1 }]} selectable>
                      {bank?.accountNumber}
                    </Text>
                    <CopyButton value={bank?.accountNumber ?? ""} label="account number" />
                  </View>
                </View>
              </View>
            </View>

            {/* 2. The code that ties the payment to this order */}
            <View style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Text style={styles.stepTitle}>Type this code in the transfer's "remarks" or "note"</Text>
                <View style={styles.codeBox}>
                  <Text style={[styles.code, styles.mono]} selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {p.reference}
                  </Text>
                  <CopyButton value={p.reference} label="code" big />
                </View>
                <Text style={styles.hint}>It tells us the money is from you.</Text>
              </View>
            </View>

            {/* 3. Show us the receipt */}
            <View style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>3</Text>
              </View>
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Text style={styles.stepTitle}>Send us a photo of the receipt</Text>
                <Text style={styles.hint}>A screenshot from your bank app is fine.</Text>
              </View>
            </View>
            <Tap style={styles.button} onPress={() => sendSlip(p)} disabled={sending} scaleTo={0.97}>
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <ImageUp size={20} color="#fff" />
                  <Text style={styles.buttonText}>I've paid: add the receipt</Text>
                </>
              )}
            </Tap>
          </View>
        )}

        {(p.status === "REQUESTED" || p.status === "AWAITING_PAYMENT") && (
          <Tap style={styles.link} onPress={() => confirmCancel(p)}>
            <Text style={styles.linkText}>Cancel</Text>
          </Tap>
        )}
      </View>
    </FadeIn>
  );

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Payments" />}
      {!purchases ? (
        <View style={{ paddingHorizontal: gutter }}>
          <RowSkeleton count={4} />
        </View>
      ) : (
        <FlatList showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          data={purchases}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon={Wallet} title="Nothing here yet" message="Ads, boosts and items you buy through Alibe appear here." actionLabel="Advertise on Alibe" onAction={() => navigation.navigate("BuyAd")} />}
          ListFooterComponent={
            purchases.length ? (
              <Tap style={styles.link} onPress={() => navigation.navigate("BuyAd")}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Megaphone size={15} color={colors.primary} />
                  <Text style={[styles.linkText, { color: colors.primary }]}>Advertise on Alibe</Text>
                </View>
              </Tap>
            ) : undefined
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingVertical: spacing.md, gap: spacing.md, width: "100%", maxWidth: contentWidth.list, alignSelf: "center", flexGrow: 1, justifyContent: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  kind: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.primary },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginTop: 2 },
  status: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs, lineHeight: fontSize.sm * 1.4 },
  stats: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.xs },
  cardButton: { flexDirection: "row", gap: spacing.sm, height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  cardNote: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: "center", marginTop: 6 },
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted },
  payBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryTint },
  step: { flexDirection: "row", gap: spacing.sm + 4, marginBottom: spacing.md },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.base },
  stepTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text, lineHeight: 22, marginTop: 2 },
  bankCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md },
  bankLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  bankValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginTop: 2 },
  copyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mono: { letterSpacing: 1 },
  codeBox: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 2, borderStyle: "dashed", borderColor: colors.primary },
  code: { flexShrink: 1, fontSize: 22, whiteSpace: "nowrap" as any, fontWeight: fontWeight.extrabold, color: colors.text },
  hint: { fontSize: fontSize.sm, color: colors.textMuted },
  copy: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: colors.primaryTint },
  copyBig: { height: 44, paddingHorizontal: 16, borderRadius: 22 },
  copyText: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold, color: colors.primary },
  button: { flexDirection: "row", gap: spacing.sm, height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.xs },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  link: { alignItems: "center", paddingTop: spacing.md },
  linkText: { color: colors.textMuted, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
}));
