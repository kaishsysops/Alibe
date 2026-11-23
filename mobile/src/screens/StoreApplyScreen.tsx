import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Store, Building2, CheckCircle2, AlertTriangle, Receipt, ArrowRight, Clock } from "lucide-react-native";
import { api, errorMessage, SellerMe } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import PhotoSlot from "../components/PhotoSlot";
import IdForm, { emptyId, idPayload, idMissing, missingMessage, IdDraft } from "../components/IdForm";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import Tap from "../components/Tap";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

// Register a business as a store: name, logo, registration number, and the
// owner's ID (skipped if they're already verified). A Seller approver checks it.
export default function StoreApplyScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { updateUser } = useAuth();
  const { isDesktopWeb, gutter } = useResponsive();
  const [me, setMe] = useState<SellerMe | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [reg, setReg] = useState("");
  const [id, setId] = useState<IdDraft>(emptyId);

  useEffect(() => {
    api
      .sellerMe()
      .then((m) => {
        setMe(m);
        if (m.store) {
          setName(m.store.name);
          setLogo(m.store.logoUrl);
          setReg(m.store.registrationNumber);
        }
      })
      .catch((e) => toast.error(errorMessage(e)));
  }, [toast]);

  const needsId = !!me && !me.verified;
  const missing = [
    ...(name.trim().length < 2 ? ["the business name"] : []),
    ...(!logo ? ["the logo"] : []),
    ...(reg.trim().length < 3 ? ["the registration number"] : []),
    ...(needsId ? idMissing(id) : []),
  ];
  const ready = missing.length === 0;

  const [submit, submitting] = useSingleFlight(async () => {
    if (!ready) return toast.error(missingMessage(missing));
    try {
      await api.applyStore({ name: name.trim(), logoUrl: logo!, registrationNumber: reg.trim(), ...(needsId ? idPayload(id) : {}) });
      updateUser({ sellerKind: "STORE" });
      toast.success("Sent. We'll tell you once your store is approved.");
      navigation.replace("SellerAccount");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const pending = me?.storeApplication?.status === "PENDING";
  const approved = me?.store?.status === "APPROVED";

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Register a store" />}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Store size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Sell as a store</Text>
          <Text style={styles.lead}>For registered businesses. A store gets its own page, the Store badge and a place above individual sellers.</Text>
        </View>

        <View style={styles.warning}>
          <AlertTriangle size={18} color={colors.gold} />
          <Text style={styles.warningText}>Businesses must register as a store. Staff ban shops that sell as individuals.</Text>
        </View>

        {me && (
          <View style={styles.fee}>
            <View style={styles.feeIcon}>
              <Receipt size={19} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.feeTitle}>
                Stores pay MVR {me.prices.storeMonthly.toLocaleString()} a month or MVR {me.prices.storeYearly.toLocaleString()} a year
              </Text>
              <Text style={styles.feeText}>Applying is free. You pay for the Store plan only once your store is approved; your store page opens when the payment is confirmed.</Text>
            </View>
          </View>
        )}

        {!me ? (
          <SkeletonGroup>
            <Skeleton width="100%" height={320} rounded={radius.lg} />
          </SkeletonGroup>
        ) : approved ? (
          <View style={styles.doneCard}>
            <View style={styles.doneIcon}>
              <CheckCircle2 size={30} color={colors.success} />
            </View>
            <Text style={styles.doneTitle}>{me.store!.name} is approved</Text>
            <Text style={styles.doneText}>One last step: choose a Store plan. Your store page opens as soon as we've confirmed the payment.</Text>
            <Tap style={styles.bigButton} onPress={() => navigation.navigate("SellerAccount", { focus: "store-plan" })} scaleTo={0.97} accessibilityLabel="Choose your Store plan">
              <Text style={styles.bigButtonText}>Choose your Store plan</Text>
              <ArrowRight size={20} color="#fff" />
            </Tap>
          </View>
        ) : pending ? (
          <View style={[styles.status, { backgroundColor: colors.primaryTint }]}>
            <Clock size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Your store is being checked</Text>
              <Text style={styles.statusText}>You'll get a notification and an email with the result. Nothing else to do for now.</Text>
            </View>
          </View>
        ) : (
          <>
            {me.store?.status === "REJECTED" && (
              <View style={[styles.status, { backgroundColor: `${colors.danger}12` }]}>
                <AlertTriangle size={20} color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>Last time it wasn't approved</Text>
                  <Text style={styles.statusText}>{me.store.rejectReason ?? "The details couldn't be checked."} Fix it below and send again.</Text>
                </View>
              </View>
            )}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your business</Text>
              <View style={styles.logoRow}>
                <PhotoSlot label="Logo" hint="Square works best" value={logo} onChange={setLogo} Icon={Store} square style={styles.logoSlot} />
                <View style={styles.logoFields}>
                  <View>
                    <Text style={styles.label}>Business name</Text>
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Coral Electronics" placeholderTextColor={colors.textMuted} maxLength={60} accessibilityLabel="Business name" />
                  </View>
                  <View>
                    <Text style={styles.label}>Registration number</Text>
                    <View style={styles.inputRow}>
                      <Building2 size={17} color={colors.textMuted} />
                      <TextInput style={styles.inputBare} value={reg} onChangeText={(t) => setReg(t.toUpperCase())} placeholder="e.g. C-1234/2024" placeholderTextColor={colors.textMuted} autoCapitalize="characters" maxLength={40} accessibilityLabel="Registration number" />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {needsId ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>The owner's ID</Text>
                <Text style={styles.cardText}>So we know a real person stands behind the store. Approving the store verifies you too.</Text>
                <IdForm value={id} onChange={setId} />
              </View>
            ) : (
              <View style={[styles.status, { backgroundColor: `${colors.success}14` }]}>
                <CheckCircle2 size={20} color={colors.success} />
                <Text style={[styles.statusText, { flex: 1, color: colors.text }]}>You're already verified, so no ID photos needed.</Text>
              </View>
            )}

            <Tap style={[styles.button, !ready && { opacity: 0.5 }]} onPress={() => submit()} disabled={submitting} scaleTo={0.97}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send for approval</Text>}
            </Tap>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingVertical: spacing.lg, gap: spacing.md, width: "100%", maxWidth: contentWidth.form, alignSelf: "center", flexGrow: 1, justifyContent: "center" },
  hero: { alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md },
  heroIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, textAlign: "center" },
  lead: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", lineHeight: 21, maxWidth: 420 },
  warning: { flexDirection: "row", gap: spacing.sm, alignItems: "center", padding: spacing.sm + 4, borderRadius: radius.md, backgroundColor: `${colors.gold}1A` },
  warningText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.md, ...cardShadow },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  cardText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: -8, lineHeight: 19 },
  logoRow: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap", alignItems: "flex-start" },
  logoSlot: { flexGrow: 0, flexBasis: "auto", width: 128, minWidth: 0 },
  logoFields: { flexGrow: 1, flexBasis: 240, gap: spacing.sm + 4 },
  fee: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary },
  feeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  feeTitle: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: colors.text },
  feeText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2, lineHeight: 19 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 6 },
  input: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.background, outlineStyle: "none" as any },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  inputBare: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  doneCard: { alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1.5, borderColor: `${colors.success}55`, ...cardShadow },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.success}1A`, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text, textAlign: "center" },
  doneText: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", lineHeight: 21, maxWidth: 400 },
  bigButton: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch", height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  bigButtonText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.md },
  status: { flexDirection: "row", gap: spacing.sm + 4, padding: spacing.md, borderRadius: radius.lg, alignItems: "flex-start" },
  statusTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  statusText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2, lineHeight: 19 },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
}));
