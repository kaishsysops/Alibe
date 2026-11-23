import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { useLinkTo, useRoute } from "@react-navigation/native";
import { CreditCard, Lock, FlaskConical, XCircle } from "lucide-react-native";
import { api, errorMessage } from "../api/client";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, controlHeight, cardShadow } from "../theme/theme";

// Test mode only: stands in for Bank of Maldives' card payment page, so the
// whole card flow can be tried without BML (backend/src/bml.ts). No card is
// charged and nothing typed here is sent anywhere.
export default function TestCheckoutScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const route = useRoute<any>();
  const linkTo = useLinkTo();
  const toast = useToast();
  const id: string = route.params?.id;
  const [tx, setTx] = useState<Awaited<ReturnType<typeof api.testCheckout>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/30");
  const [cvc, setCvc] = useState("123");
  const [busy, setBusy] = useState<"pay" | "decline" | null>(null);

  useEffect(() => {
    api.testCheckout(id).then(setTx).catch((e) => setError(errorMessage(e)));
  }, [id]);

  const finish = async (approve: boolean) => {
    if (!tx) return;
    setBusy(approve ? "pay" : "decline");
    try {
      const r = await api.finishTestCheckout(tx.id, approve);
      if (!approve) toast.info("Test payment declined. Nothing was charged.");
      // Back to Alibe, like BML's page sends people back after paying.
      linkTo(r.returnTo);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <View style={styles.testBar}>
        <FlaskConical size={16} color="#fff" />
        <Text style={styles.testBarText}>TEST CHECKOUT · stands in for BML's card page · no real money</Text>
      </View>

      {error ? (
        <View style={styles.card}>
          <XCircle size={28} color={colors.danger} />
          <Text style={styles.title}>This payment link isn't valid</Text>
          <Text style={styles.muted}>{error}</Text>
          <Tap style={styles.secondary} onPress={() => linkTo("/purchases")} scaleTo={0.97}>
            <Text style={styles.secondaryText}>Back to payments</Text>
          </Tap>
        </View>
      ) : !tx ? (
        <ActivityIndicator color={colors.primary} style={{ margin: spacing.xl }} />
      ) : tx.state !== "INITIATED" ? (
        <View style={styles.card}>
          <Text style={styles.title}>{tx.state === "CONFIRMED" ? "Already paid" : "This payment was cancelled"}</Text>
          <Tap style={styles.secondary} onPress={() => linkTo(tx.returnTo)} scaleTo={0.97}>
            <Text style={styles.secondaryText}>Back to Alibe</Text>
          </Tap>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.merchant}>
            <View style={styles.merchantIcon}>
              <CreditCard size={20} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.muted}>Pay to</Text>
              <Text style={styles.merchantName}>Alibe</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.muted}>Amount</Text>
              <Text style={styles.amount}>
                {tx.currency} {tx.amount.toLocaleString()}
              </Text>
            </View>
          </View>
          <Text style={styles.what}>
            {tx.what} · {tx.reference}
          </Text>

          <Text style={styles.label}>Card number</Text>
          <TextInput style={styles.input} value={card} onChangeText={setCard} keyboardType="number-pad" maxLength={19} accessibilityLabel="Card number (test)" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Expiry</Text>
              <TextInput style={styles.input} value={expiry} onChangeText={setExpiry} maxLength={5} accessibilityLabel="Expiry (test)" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>CVC</Text>
              <TextInput style={styles.input} value={cvc} onChangeText={setCvc} keyboardType="number-pad" maxLength={4} secureTextEntry accessibilityLabel="CVC (test)" />
            </View>
          </View>
          <Text style={styles.note}>These are test details. Nothing you type here is sent anywhere or charged.</Text>

          <Tap style={styles.pay} onPress={() => finish(true)} disabled={!!busy} scaleTo={0.97}>
            {busy === "pay" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Lock size={17} color="#fff" />
                <Text style={styles.payText}>
                  Pay {tx.currency} {tx.amount.toLocaleString()}
                </Text>
              </>
            )}
          </Tap>
          <View style={styles.row}>
            <Tap style={[styles.secondary, { flex: 1 }]} onPress={() => finish(false)} disabled={!!busy} scaleTo={0.97}>
              {busy === "decline" ? <ActivityIndicator color={colors.danger} /> : <Text style={[styles.secondaryText, { color: colors.danger }]}>Decline (test a failed payment)</Text>}
            </Tap>
          </View>
          <Tap onPress={() => linkTo(tx.returnTo)} scaleTo={0.97} style={{ alignSelf: "center", padding: spacing.sm }}>
            <Text style={styles.muted}>Cancel and go back</Text>
          </Tap>
        </View>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  page: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
  testBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: "#7B5CF5" },
  testBarText: { color: "#fff", fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, letterSpacing: 0.4 },
  card: { width: "100%", maxWidth: 440, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...cardShadow },
  merchant: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  merchantIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  merchantName: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  amount: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  what: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  muted: { fontSize: fontSize.caption, color: colors.textMuted },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.xs },
  input: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.background, letterSpacing: 1, outlineStyle: "none" as any },
  row: { flexDirection: "row", gap: spacing.sm },
  note: { fontSize: fontSize.caption, color: colors.textMuted, marginVertical: spacing.xs },
  pay: { flexDirection: "row", gap: spacing.sm, height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.text, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  payText: { color: colors.background, fontWeight: fontWeight.extrabold, fontSize: fontSize.md },
  secondary: { height: 46, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  secondaryText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
}));
