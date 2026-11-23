import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Zap, Infinity as InfinityIcon, Rocket, Clock, XCircle } from "lucide-react-native";
import { api, errorMessage, SellerMe } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import { VerifiedBadge } from "../components/Badges";
import IdForm, { emptyId, idPayload, idReady, idMissing, missingMessage, IdDraft } from "../components/IdForm";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import Tap from "../components/Tap";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { timeAgo } from "../utils/time";

// Optional ID check. Verified sellers post without waiting for review, have
// no listing limit, can buy boosts and get the blue tick.
const PERKS = [
  { Icon: Zap, title: "Posts go live instantly", text: "After your first 5 posts, unverified sellers wait for our team to check each one." },
  { Icon: InfinityIcon, title: "The blue tick", text: "Buyers see you're a real, ID-checked person." },
  { Icon: Rocket, title: "Boosts and Premium", text: "Put items at the top, and unlock Premium." },
];

export default function VerifyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { updateUser } = useAuth();
  const { isDesktopWeb, gutter } = useResponsive();
  const [me, setMe] = useState<SellerMe | null>(null);
  const [draft, setDraft] = useState<IdDraft>(emptyId);

  useFocusEffect(
    useCallback(() => {
      api
        .sellerMe()
        .then((m) => {
          setMe(m);
          if (m.verified) updateUser({ verificationStatus: "VERIFIED" });
        })
        .catch((e) => toast.error(errorMessage(e)));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const [submit, submitting] = useSingleFlight(async () => {
    if (!idReady(draft)) return toast.error(missingMessage(idMissing(draft)));
    try {
      await api.applyVerify(idPayload(draft));
      toast.success("Sent. We'll let you know once it's checked.");
      setMe(await api.sellerMe());
      setDraft(emptyId);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const app = me?.verifyApplication;
  const pending = app?.status === "PENDING";
  const rejected = app?.status === "REJECTED";

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Get verified" />}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <VerifiedBadge size={40} />
          </View>
          <Text style={styles.title}>{me?.verified ? "You're verified" : "Get the blue tick"}</Text>
          <Text style={styles.lead}>{me?.verified ? "Buyers see the tick on your items and profile. Your posts go live straight away." : "Verifying is optional. It takes a minute, and a person on our team checks it."}</Text>
        </View>

        <View style={styles.perks}>
          {PERKS.map(({ Icon, title, text }) => (
            <View key={title} style={styles.perk}>
              <View style={[styles.perkIcon, me?.verified && { backgroundColor: `${colors.success}1A` }]}>
                <Icon size={18} color={me?.verified ? colors.success : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{title}</Text>
                <Text style={styles.perkText}>{text}</Text>
              </View>
            </View>
          ))}
        </View>

        {!me ? (
          <SkeletonGroup>
            <Skeleton width="100%" height={260} rounded={radius.lg} />
          </SkeletonGroup>
        ) : me.verified ? (
          <Tap style={styles.button} onPress={() => navigation.navigate("SellerAccount")} scaleTo={0.97}>
            <Text style={styles.buttonText}>See your seller account</Text>
          </Tap>
        ) : pending ? (
          <View style={[styles.status, { backgroundColor: colors.primaryTint }]}>
            <Clock size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Being checked</Text>
              <Text style={styles.statusText}>Sent {timeAgo(app!.createdAt, true)}. You'll get a notification and an email with the result.</Text>
            </View>
          </View>
        ) : (
          <>
            {rejected && (
              <View style={[styles.status, { backgroundColor: `${colors.danger}12` }]}>
                <XCircle size={20} color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>Last time it wasn't approved</Text>
                  <Text style={styles.statusText}>{app?.note ?? "The photos couldn't be checked."} You can try again below.</Text>
                </View>
              </View>
            )}
            <View style={styles.card}>
              <IdForm value={draft} onChange={setDraft} />
              <Tap style={[styles.button, !idReady(draft) && { opacity: 0.5 }]} onPress={() => submit()} disabled={submitting} scaleTo={0.97}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send for checking</Text>}
              </Tap>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingVertical: spacing.lg, gap: spacing.md, width: "100%", maxWidth: contentWidth.form, alignSelf: "center", flexGrow: 1, justifyContent: "center" },
  hero: { alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md },
  heroIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: `${colors.verified}1A`, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, textAlign: "center" },
  lead: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", lineHeight: 21, maxWidth: 400 },
  perks: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md, ...cardShadow },
  perk: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  perkIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  perkTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  perkText: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.md, ...cardShadow },
  status: { flexDirection: "row", gap: spacing.sm + 4, padding: spacing.md, borderRadius: radius.lg, alignItems: "flex-start" },
  statusTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  statusText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2, lineHeight: 19 },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
}));
