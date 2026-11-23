import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Crown, Rocket, Sparkles, ChevronRight, Check, Infinity as InfinityIcon, ArrowUpCircle, BarChart3, Images } from "lucide-react-native";
import { api, SellerMe } from "../api/client";
import { useAuth } from "../api/AuthContext";
import Tap from "./Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";

// One fetch of the seller's standing shared by every promo on screen, kept
// for a minute.
let cached: { at: number; userId: string; me: SellerMe } | null = null;
export function useSellerStanding() {
  const { user } = useAuth();
  const [me, setMe] = useState<SellerMe | null>(cached && cached.userId === user?.id ? cached.me : null);
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      if (cached && cached.userId === user.id && Date.now() - cached.at < 60_000) return setMe(cached.me);
      api
        .sellerMe()
        .then((m) => {
          cached = { at: Date.now(), userId: user.id, me: m };
          setMe(m);
        })
        .catch(() => {});
    }, [user?.id])
  );
  return me;
}

// "Go Premium": shown to sellers who don't have it. `card` is the full pitch;
// `banner` is one line for list screens.
// `style` is for spacing around it; nothing is drawn (and no gap left) when hidden.
export default function PremiumPromo({ variant = "card", style }: { variant?: "card" | "banner"; style?: object }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const me = useSellerStanding();
  if (!me || me.premium) return null;
  const price = me.prices.premiumMonthly;
  const open = () => navigation.navigate(me.approved ? "SellerAccount" : "Verify");

  if (variant === "banner") {
    return (
      <Tap style={[styles.banner, style]} onPress={open} scaleTo={0.98} accessibilityLabel="Go Premium">
        <View style={styles.bannerIcon}>
          <Crown size={16} color="#fff" fill="#fff" />
        </View>
        <Text style={styles.bannerText} numberOfLines={2}>
          <Text style={styles.bannerStrong}>Go Premium</Text> · {me.premiumFreeBoosts} free boosts a month and your new items featured
        </Text>
        <ChevronRight size={16} color={colors.gold} />
      </Tap>
    );
  }

  return (
    <Tap style={[styles.card, style]} onPress={open} scaleTo={0.985} accessibilityLabel="Go Premium">
      <View style={styles.glow} />
      <View style={styles.head}>
        <View style={styles.crown}>
          <Crown size={22} color="#fff" fill="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>ALIBE PREMIUM</Text>
          <Text style={styles.title}>Sell faster, stand out</Text>
        </View>
      </View>
      <View style={styles.perks}>
        {[
          { Icon: Rocket, text: `${me.premiumFreeBoosts} free 7-day boosts every month` },
          { Icon: Sparkles, text: "New items featured at the top for a week" },
          { Icon: InfinityIcon, text: "No monthly post limit (others: 30 a month)" },
          { Icon: ArrowUpCircle, text: "Bump any item to the top, once a day" },
          { Icon: BarChart3, text: "See how many people viewed and saved each item" },
          { Icon: Images, text: "12 photos per item instead of 6" },
          { Icon: Crown, text: "Gold Premium badge on everything you sell" },
        ].map(({ Icon, text }) => (
          <View key={text} style={styles.perk}>
            <View style={styles.perkIcon}>
              <Icon size={13} color={colors.gold} />
            </View>
            <Text style={styles.perkText}>{text}</Text>
          </View>
        ))}
      </View>
      <View style={styles.foot}>
        <Text style={styles.price}>
          MVR {price.toLocaleString()}
          <Text style={styles.per}> / month</Text>
        </Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{me.approved ? "Go Premium" : "Get verified first"}</Text>
          {me.approved ? <ChevronRight size={16} color="#fff" /> : <Check size={15} color="#fff" />}
        </View>
      </View>
    </Tap>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.md, backgroundColor: colors.card, borderWidth: 1.5, borderColor: `${colors.gold}66`, overflow: "hidden", ...cardShadow },
  glow: { position: "absolute", right: -60, top: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: `${colors.gold}1F` },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  crown: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  kicker: { fontSize: fontSize.micro, fontWeight: fontWeight.extrabold, color: colors.gold, letterSpacing: 1 },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: 1 },
  perks: { gap: 8 },
  perk: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  perkIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: `${colors.gold}1F`, alignItems: "center", justifyContent: "center" },
  perkText: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
  price: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  per: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
  cta: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 40, borderRadius: 20, backgroundColor: colors.gold },
  ctaText: { color: "#fff", fontSize: fontSize.sm, fontWeight: fontWeight.extrabold },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, padding: spacing.sm + 4, borderRadius: radius.lg, backgroundColor: `${colors.gold}16`, borderWidth: 1, borderColor: `${colors.gold}55` },
  bannerIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  bannerText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 18 },
  bannerStrong: { fontWeight: fontWeight.extrabold },
}));
