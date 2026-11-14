import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useRoute } from "@react-navigation/native";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, fontSize, fontWeight, lineHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

// Privacy policy and terms, in plain language. Both app stores require a
// privacy policy link; the web app serves these at /privacy and /terms.
// Keep them in step with what the app really does.
const UPDATED = "14 November 2026";

type Section = { title: string; body: string[] };

const PRIVACY: Section[] = [
  {
    title: "What we collect",
    body: [
      "Your email address, and your phone number if you add one. We use them to sign you in and to reach you about your account.",
      "Your name, username, profile photo, island and the categories you follow.",
      "What you post: listings, photos, prices, descriptions and their location (island).",
      "Messages, offers, orders, reviews and reports you send on Alibe.",
      "Payment slips you upload for paid services (boosts, ads, buy-for-you). Only Alibe staff can open them.",
      "Basic technical data such as your IP address and device notification token, to keep the service working and to stop abuse.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "To run the marketplace: show your listings, deliver messages, handle orders and notify you.",
      "To keep people safe: we check chats for common scam patterns, compare listing photos to spot stolen pictures, and review reports.",
      "To help you sell and search: listing titles and search words may be sent to Cloudflare's AI service to suggest a category or understand a search. They are not used to identify you.",
    ],
  },
  {
    title: "Who sees it",
    body: [
      "Buyers see your listings, your public profile and, if you choose, your contact buttons.",
      "Your email and phone number are never shown to other users unless you switch that on.",
      "Service providers that help us run Alibe: our server host, Resend (sign-in emails) and Cloudflare (network and optional AI). They only get what they need for that job.",
      "We do not sell your data.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can edit your profile, contact settings and listings at any time.",
      "You can delete your account in Profile. Your listings, messages and profile are removed. Records we must keep for safety or the law (for example a ban on a scam account) may be kept.",
      "Some things are stored only on your phone, such as drafts and recent searches. Signing out clears them.",
    ],
  },
  {
    title: "Questions",
    body: ["Contact Alibe from Help in your profile."],
  },
];

const TERMS: Section[] = [
  {
    title: "Using Alibe",
    body: [
      "Alibe is a place for people in the Maldives to buy and sell. Sales are between the buyer and the seller.",
      "Use your real details. One person, one account.",
      "Be respectful in chats. No spam, threats or harassment.",
    ],
  },
  {
    title: "What you can't list",
    body: [
      "Anything illegal in the Maldives, including weapons, drugs, alcohol, stolen goods and fake products.",
      "Listings that mislead buyers, or photos that aren't of the real item or aren't yours to use.",
      "Alibe may remove listings and suspend or ban accounts that break these rules.",
    ],
  },
  {
    title: "Paying and handing over",
    body: [
      "Never pay in full before you have the item. Give the seller your handover code only when the item is in your hands.",
      "Alibe doesn't hold money for buyers or sellers. Paid Alibe services (boosts, ads, buy-for-you) are paid to Alibe and only start once staff approve the payment.",
      "If something goes wrong with an order, open a dispute on the order and add your evidence. Staff will look at both sides.",
    ],
  },
  {
    title: "Your content",
    body: [
      "You own what you post. You let Alibe show it in the app and on alibe.online so buyers can find it.",
      "Items marked From iBay are shown from iBay's public pages and sold through Alibe at the price shown.",
    ],
  },
  {
    title: "Changes",
    body: ["We may update these terms. If a change matters, we'll tell you in the app before it applies."],
  },
];

export default function LegalScreen() {
  const styles = useStyles();
  const route = useRoute<any>();
  const { isDesktopWeb, gutter } = useResponsive();
  const privacy = route.name === "Privacy";
  const sections = privacy ? PRIVACY : TERMS;
  const title = privacy ? "Privacy policy" : "Terms of use";
  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title={title} />}
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
        {isDesktopWeb && <Text style={styles.pageTitle}>{title}</Text>}
        <Text style={styles.updated}>Last updated {UPDATED}</Text>
        {sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.heading}>{s.title}</Text>
            {s.body.map((p) => (
              <View key={p} style={styles.point}>
                <View style={styles.bullet} />
                <Text style={styles.text}>{p}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  body: { paddingVertical: spacing.lg, width: "100%", maxWidth: contentWidth.list, alignSelf: "center", paddingBottom: spacing.xl * 2 },
  pageTitle: { fontSize: fontSize.display, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.xs },
  updated: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },
  section: { marginBottom: spacing.lg, gap: spacing.sm },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  point: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 9 },
  text: { flex: 1, fontSize: fontSize.md, lineHeight: Math.round(fontSize.md * lineHeight.relaxed), color: colors.text },
}));
