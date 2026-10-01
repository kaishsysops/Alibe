import React, { useCallback, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { ShieldCheck, PackageCheck, Truck, KeyRound, Ship, Check } from "lucide-react-native";
import { api, VerificationProgress } from "../api/client";
import { useAuth } from "../api/AuthContext";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import { VerifiedBadge } from "../components/Badges";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

const STEPS = [
  { icon: PackageCheck, title: "Make a sale", text: "Accept an offer, or tap \"Sell to this buyer\" in a chat. An order is created." },
  { icon: Truck, title: "Deliver it yourself", text: "You're responsible for getting it to the buyer: pickup, courier or ferry." },
  { icon: Ship, title: "Ferry orders need boat details", text: "Name the boat and its departure time so the buyer knows what to meet." },
  { icon: KeyRound, title: "The buyer's code proves delivery", text: "Every order gives the buyer a private 4-digit code. They give it to you only once the item is in their hands, and you enter it to complete the delivery." },
];

export default function VerifyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { user, updateUser } = useAuth();
  const { isDesktopWeb } = useResponsive();
  const [progress, setProgress] = useState<VerificationProgress | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api
        .verification(user.id)
        .then((p) => {
          setProgress(p);
          if (p.verificationStatus !== user.verificationStatus) updateUser({ verificationStatus: p.verificationStatus });
        })
        .catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])
  );

  const verified = progress?.verificationStatus === "VERIFIED";
  const done = Math.min(progress?.delivered ?? 0, progress?.required ?? 5);
  const required = progress?.required ?? 5;

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Verified seller" />}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>{verified ? <VerifiedBadge size={34} /> : <ShieldCheck size={30} color={colors.verified} />}</View>
          <Text style={styles.heroTitle}>{verified ? "You're a verified seller" : "Earn the verified tick"}</Text>
          <Text style={styles.heroText}>
            {verified
              ? "Buyers see the blue tick on your profile, listings and chats."
              : `Complete ${required} deliveries that buyers confirm, and the blue tick is added automatically.`}
          </Text>

          {!progress ? (
            <SkeletonGroup>
              <View style={styles.dots}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} width={44} height={44} rounded={22} />
                ))}
              </View>
            </SkeletonGroup>
          ) : (
            <>
              <View style={styles.dots} accessibilityLabel={`${done} of ${required} verified deliveries`}>
                {Array.from({ length: required }).map((_, i) => (
                  <View key={i} style={[styles.dot, i < done && styles.dotDone]}>
                    {i < done ? <Check size={20} color="#fff" strokeWidth={3} /> : <Text style={styles.dotText}>{i + 1}</Text>}
                  </View>
                ))}
              </View>
              <Text style={styles.count}>
                {done} of {required} verified deliveries
              </Text>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={styles.card}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={[styles.step, i > 0 && styles.stepBorder]}>
              <View style={styles.stepIcon}>
                <s.icon size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.footnote}>Cancelled orders and deliveries with a reported problem don't count.</Text>

        <Tap style={styles.button} onPress={() => navigation.navigate("Orders", { tab: "SELLING" })}>
          <Text style={styles.buttonText}>View my orders</Text>
        </Tap>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 600, alignSelf: "center" },
  hero: { alignItems: "center", backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...cardShadow },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.verified}1F`, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  heroTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text, textAlign: "center" },
  heroText: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs, lineHeight: fontSize.base * 1.4, maxWidth: 360 },
  dots: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  dot: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: colors.verified, borderColor: colors.verified },
  dotText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textMuted },
  count: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, ...cardShadow, overflow: "hidden" },
  step: { flexDirection: "row", gap: spacing.sm + 4, padding: spacing.md },
  stepBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  stepIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  stepTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  stepText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2, lineHeight: fontSize.sm * 1.45 },
  footnote: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center" },
  button: { height: 52, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
}));
