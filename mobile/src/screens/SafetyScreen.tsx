import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { KeyRound, MessageSquareWarning, ShieldCheck, Ship, Flag, Ban, Check } from "lucide-react-native";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import { FadeIn } from "../components/Motion";
import Tap from "../components/Tap";
import { useResponsive } from "../hooks/useResponsive";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";

// Plain-language explainer of every scam protection in the app. Linked from
// chat warnings, listings and the profile menu.
const PROTECTIONS = [
  { Icon: KeyRound, title: "Secret handover code", text: "A seller can only finish a sale with your 4-digit code. Give it to them only when the item is in your hands." },
  { Icon: MessageSquareWarning, title: "Scam warnings in chat", text: "We warn you when someone asks you to pay first, sends a link, or asks for gift cards or crypto." },
  { Icon: ShieldCheck, title: "Trust badges", text: "See how many deliveries a seller has finished, their reviews, and how long they've been on Alibe." },
  { Icon: Ship, title: "Ferry and courier details", text: "Sellers must tell you the boat name and when it leaves, so you know exactly what to collect." },
  { Icon: Flag, title: "Report anyone suspicious", text: "Accounts reported by several people are marked so others can see." },
  { Icon: Ban, title: "Block in one tap", text: "Blocked people can't message you or see your listings." },
];

const RULES = ["Never pay before the item is in your hands.", "Never share your secret code early.", "Never pay with gift cards or crypto.", "Keep chats inside Alibe so we can warn you."];

export default function SafetyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { isDesktopWeb, gutter } = useResponsive();

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title="Staying safe" />}
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + spacing.xl }, isDesktopWeb && styles.desktop]}>
        <FadeIn>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <ShieldCheck size={30} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>Scam protection built in</Text>
            <Text style={styles.heroText}>Alibe is built so that paying for something you never get is very hard. Here's how.</Text>
          </View>
        </FadeIn>

        <FadeIn delay={80}>
          <View style={styles.rules}>
            <Text style={styles.rulesTitle}>The 4 golden rules</Text>
            {RULES.map((r) => (
              <View key={r} style={styles.ruleRow}>
                <View style={styles.ruleCheck}>
                  <Check size={14} color="#fff" strokeWidth={3} />
                </View>
                <Text style={styles.ruleText}>{r}</Text>
              </View>
            ))}
          </View>
        </FadeIn>

        {PROTECTIONS.map(({ Icon, title, text }, i) => (
          <FadeIn key={title} delay={140 + i * 50}>
            <View style={styles.item}>
              <View style={styles.itemIcon}>
                <Icon size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{title}</Text>
                <Text style={styles.itemText}>{text}</Text>
              </View>
            </View>
          </FadeIn>
        ))}

        <Tap style={styles.button} onPress={() => navigation.goBack()} scaleTo={0.97}>
          <Text style={styles.buttonText}>Got it</Text>
        </Tap>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: spacing.sm, gap: spacing.md },
  desktop: { maxWidth: 560, width: "100%", alignSelf: "center", paddingTop: spacing.lg },
  hero: { alignItems: "center", padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primaryTint },
  heroIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.md, textAlign: "center" },
  heroText: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center", lineHeight: fontSize.md * 1.45 },
  rules: { padding: spacing.md + 4, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow, gap: spacing.sm + 4 },
  rulesTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  ruleCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  ruleText: { flex: 1, fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.semibold },
  item: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow },
  itemIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  itemText: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 2, lineHeight: fontSize.base * 1.45 },
  button: { height: 54, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  buttonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: fontWeight.bold },
}));
