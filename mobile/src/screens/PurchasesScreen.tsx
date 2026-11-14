import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Megaphone, Wallet } from "lucide-react-native";
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

const KIND_LABEL = { BOOST: "Boost", AD: "Ad", BUY_FOR_YOU: "Buy through Alibe" } as const;

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

export default function PurchasesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { isDesktopWeb, gutter } = useResponsive();
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      api
        .myPurchases()
        .then((res) => {
          setPurchases(res.purchases);
          setBank(res.bank);
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
            <Text style={styles.payAmount}>Pay MVR {p.amount.toLocaleString()}</Text>
            <Text style={styles.payLine}>Bank: {bank?.bankName}</Text>
            <Text style={styles.payLine}>Account name: {bank?.accountName}</Text>
            <Text style={styles.payLine} selectable>
              Account number: {bank?.accountNumber}
            </Text>
            <Text style={styles.payRef} selectable>
              Put this in the transfer note: {p.reference}
            </Text>
            <Tap style={styles.button} onPress={() => sendSlip(p)} disabled={sending} scaleTo={0.97}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>I've paid. Upload my slip</Text>}
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
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="My purchases" />}
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
  list: { paddingVertical: spacing.md, gap: spacing.md, width: "100%", maxWidth: contentWidth.list, alignSelf: "center", flexGrow: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  kind: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.primary },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginTop: 2 },
  status: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs, lineHeight: fontSize.sm * 1.4 },
  stats: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.xs },
  payBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryTint },
  payAmount: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.xs },
  payLine: { fontSize: fontSize.sm, color: colors.text, marginTop: 3 },
  payRef: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.sm },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  link: { alignItems: "center", paddingTop: spacing.md },
  linkText: { color: colors.textMuted, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
}));
