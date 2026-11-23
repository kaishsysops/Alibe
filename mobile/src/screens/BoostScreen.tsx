import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Rocket, TrendingUp, Search, Home, Crown, Gift, ShieldCheck, Check, Sparkles } from "lucide-react-native";
import { api, errorMessage, Listing, mediaUrl, MoneyConfig, newClientId, PlanPrices, SellerMe } from "../api/client";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import { FadeIn } from "../components/Motion";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, controlHeight, contentWidth, cardShadow } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";

const PLANS = [
  { days: 3, label: "Quick", note: "A weekend push" },
  { days: 7, label: "Popular", note: "Most sellers pick this" },
  { days: 30, label: "Month", note: "Best value per day" },
] as const;

const WHERE = [
  { Icon: Search, text: "Top of matching searches" },
  { Icon: Home, text: "The home page's Featured row" },
  { Icon: TrendingUp, text: "First in its category, with a Featured label" },
];

export default function BoostScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { isDesktopWeb, gutter } = useResponsive();
  const [config, setConfig] = useState<MoneyConfig | null>(null);
  const [me, setMe] = useState<SellerMe | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [days, setDays] = useState(7);
  const [useFree, setUseFree] = useState(false);
  const clientId = useRef(newClientId());
  const listingId: string = route.params.id;

  useEffect(() => {
    api.moneyConfig().then(setConfig).catch((e) => toast.error(errorMessage(e)));
    api
      .sellerMe()
      .then((m) => {
        setMe(m);
        if (m.freeBoosts.left > 0) setUseFree(true);
      })
      .catch(() => {});
    api.listing(listingId).then(setListing).catch(() => {});
  }, [toast, listingId]);

  const [buy, buying] = useSingleFlight(async () => {
    try {
      if (useFree) {
        await api.createPurchase({ kind: "BOOST", listingId, days: 7, useFree: true }, `${clientId.current}-free`);
        toast.success("Boosted for 7 days. It's at the top now.");
        navigation.goBack();
        return;
      }
      await api.createPurchase({ kind: "BOOST", listingId, days }, `${clientId.current}-${days}`);
      navigation.replace("Purchases");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const price = (d: number) => config?.boostPrices[String(d) as keyof PlanPrices] ?? 0;
  const perDay = (d: number) => Math.round(price(d) / d);
  const locked = me && !me.canBoost;
  const loading = !config || !me;

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title="Boost" />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]}>
        {/* The item, as it'll look boosted */}
        <View style={styles.hero}>
          <View style={styles.glow} />
          <View style={styles.preview}>
            {listing?.images[0] ? <Image source={{ uri: mediaUrl(listing.images[0]) }} style={styles.previewImage} contentFit="cover" /> : <View style={[styles.previewImage, { backgroundColor: colors.skeleton }]} />}
            <View style={styles.featured}>
              <Sparkles size={11} color="#fff" />
              <Text style={styles.featuredText}>Featured</Text>
            </View>
            <View style={styles.previewBody}>
              <Text style={styles.previewPrice}>{listing ? `MVR ${listing.price.toLocaleString()}` : " "}</Text>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {listing?.title ?? " "}
              </Text>
            </View>
          </View>
          <View style={styles.rocket}>
            <Rocket size={22} color="#fff" />
          </View>
        </View>

        <Text style={styles.title}>Get seen first</Text>
        <Text style={styles.text}>Boosted items get in front of more buyers, sooner.</Text>

        <View style={styles.where}>
          {WHERE.map(({ Icon, text }) => (
            <View key={text} style={styles.whereRow}>
              <View style={styles.whereIcon}>
                <Icon size={15} color={colors.gold} />
              </View>
              <Text style={styles.whereText}>{text}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <SkeletonGroup>
            <Skeleton width="100%" height={210} rounded={radius.lg} />
          </SkeletonGroup>
        ) : locked ? (
          <FadeIn style={styles.locked}>
            <View style={styles.lockedIcon}>
              <ShieldCheck size={24} color={colors.verified} />
            </View>
            <Text style={styles.lockedTitle}>Boosts are for verified sellers</Text>
            <Text style={styles.lockedText}>It keeps the top of Alibe trustworthy. Verifying is free and takes a minute.</Text>
            <Tap style={[styles.button, { backgroundColor: colors.verified, alignSelf: "stretch" }]} onPress={() => navigation.navigate("Verify")} scaleTo={0.97}>
              <Text style={styles.buttonText}>Get verified</Text>
            </Tap>
          </FadeIn>
        ) : (
          <FadeIn style={{ gap: spacing.sm + 2 }}>
            {me!.freeBoosts.allowance > 0 && (
              <Tap style={[styles.option, useFree && styles.optionFree, me!.freeBoosts.left === 0 && { opacity: 0.5 }]} onPress={() => me!.freeBoosts.left > 0 && setUseFree(true)} disabled={me!.freeBoosts.left === 0} scaleTo={0.98} accessibilityRole="radio" accessibilityState={{ selected: useFree }}>
                <View style={[styles.optionIcon, { backgroundColor: `${colors.gold}22` }]}>
                  <Gift size={18} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.optionTitleRow}>
                    <Text style={styles.optionTitle}>Free Premium boost</Text>
                    <Crown size={13} color={colors.gold} fill={colors.gold} />
                  </View>
                  <Text style={styles.optionNote}>
                    7 days · {me!.freeBoosts.left} of {me!.freeBoosts.allowance} left this month
                  </Text>
                </View>
                <Text style={[styles.optionPrice, { color: colors.gold }]}>Free</Text>
                <Radio on={useFree} color={colors.gold} />
              </Tap>
            )}
            {PLANS.map((p) => {
              const on = !useFree && days === p.days;
              return (
                <Tap key={p.days} style={[styles.option, on && styles.optionOn]} onPress={() => (setUseFree(false), setDays(p.days))} scaleTo={0.98} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <View style={[styles.optionIcon, on && { backgroundColor: colors.primary }]}>
                    <Text style={[styles.optionDays, on && { color: "#fff" }]}>{p.days}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.optionTitleRow}>
                      <Text style={styles.optionTitle}>{p.days} days</Text>
                      {p.days === 7 && (
                        <View style={styles.popular}>
                          <Text style={styles.popularText}>Popular</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.optionNote}>
                      {p.note} · MVR {perDay(p.days)} a day
                    </Text>
                  </View>
                  <Text style={styles.optionPrice}>MVR {price(p.days).toLocaleString()}</Text>
                  <Radio on={on} color={colors.primary} />
                </Tap>
              );
            })}
            <Tap style={[styles.button, { backgroundColor: useFree ? colors.gold : colors.primary }]} onPress={() => buy()} disabled={buying} scaleTo={0.97}>
              {buying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{useFree ? "Boost now, free" : `Continue · MVR ${price(days).toLocaleString()}`}</Text>}
            </Tap>
            <Text style={styles.small}>{useFree ? "Starts straight away." : "Pay by bank transfer on the next step. Your boost starts once we've confirmed it."}</Text>
            {!me!.premium && (
              <Tap style={styles.upsell} onPress={() => navigation.navigate("SellerAccount")} scaleTo={0.98}>
                <Crown size={16} color={colors.gold} />
                <Text style={styles.upsellText}>Premium includes {config!.premiumFreeBoosts} free boosts every month</Text>
              </Tap>
            )}
          </FadeIn>
        )}
      </ScrollView>
    </View>
  );
}

function Radio({ on, color }: { on: boolean; color: string }) {
  const styles = useStyles();
  return <View style={[styles.radio, on && { borderColor: color, backgroundColor: color }]}>{on && <Check size={12} color="#fff" strokeWidth={3.4} />}</View>;
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingVertical: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: contentWidth.form, alignSelf: "center", gap: spacing.md },
  hero: { height: 210, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, backgroundColor: `${colors.gold}14`, overflow: "hidden" },
  glow: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: `${colors.gold}22` },
  preview: { width: 150, backgroundColor: colors.card, borderRadius: radius.md, overflow: "hidden", transform: [{ rotate: "-4deg" }], ...cardShadow },
  previewImage: { width: "100%", height: 110 },
  featured: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, height: 20, borderRadius: 10, backgroundColor: colors.gold },
  featuredText: { color: "#fff", fontSize: 10, fontWeight: fontWeight.extrabold },
  previewBody: { padding: 8 },
  previewPrice: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold, color: colors.text },
  previewTitle: { fontSize: fontSize.caption, color: colors.textMuted },
  rocket: { position: "absolute", right: "26%", top: 26, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", transform: [{ rotate: "12deg" }], ...cardShadow },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.xs },
  text: { fontSize: fontSize.md, color: colors.textMuted, marginTop: -spacing.sm, lineHeight: fontSize.md * 1.4 },
  where: { gap: spacing.sm },
  whereRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  whereIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: `${colors.gold}1F`, alignItems: "center", justifyContent: "center" },
  whereText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.sm + 6, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionFree: { borderColor: colors.gold, backgroundColor: `${colors.gold}12` },
  optionIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  optionDays: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  optionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  optionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: colors.text },
  optionNote: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  optionPrice: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: colors.text },
  popular: { paddingHorizontal: 7, height: 18, borderRadius: 9, backgroundColor: colors.primary, justifyContent: "center" },
  popularText: { fontSize: 10, fontWeight: fontWeight.extrabold, color: "#fff" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  button: { height: controlHeight.primary, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  buttonText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.md },
  small: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: "center" },
  upsell: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.sm + 4, borderRadius: radius.md, backgroundColor: `${colors.gold}14`, marginTop: spacing.sm },
  upsellText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  locked: { alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow },
  lockedIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.verified}1A`, alignItems: "center", justifyContent: "center" },
  lockedTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text, textAlign: "center" },
  lockedText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", lineHeight: 19, marginBottom: spacing.sm },
}));
