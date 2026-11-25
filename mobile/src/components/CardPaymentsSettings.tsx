import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Switch, ActivityIndicator } from "react-native";
import { CreditCard, ShieldCheck, Landmark, AlertTriangle } from "lucide-react-native";
import { api, errorMessage, SellerCardSettings } from "../api/client";
import { useToast } from "./Toast";
import Tap from "./Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight } from "../theme/theme";

const BANKS = ["BML", "MIB", "CBM", "SBI", "HBL", "MCB"];
const formatMvr = (n: number) => `MVR ${n.toLocaleString("en-US")}`;

// Seller account: card payments for item sales (Premium sellers and stores).
// Buyers pay Alibe by card; Alibe holds it until the handover code confirms
// delivery, then pays the seller's bank account (backend/src/orderCard.ts).
export default function CardPaymentsSettings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [data, setData] = useState<SellerCardSettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [bankName, setBankName] = useState("BML");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.sellerCardPayments().then(setData).catch(() => {});
  }, []);
  useEffect(load, [load]);

  if (!data) return null;
  const pill = !data.eligible ? "Premium or Store" : data.on && data.payoutReady ? "On" : "Off";
  const on = pill === "On";

  const save = async (nextOn: boolean, withAccount: boolean) => {
    setSaving(true);
    try {
      await api.saveSellerCardPayments(nextOn, withAccount ? { bankName, accountName, accountNumber } : undefined);
      if (withAccount) setEditing(false);
      toast.success(nextOn ? "Card payments are on. Buyers can now pay you by card." : withAccount ? "Payout account saved." : "Card payments are off.");
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const toggle = (next: boolean) => {
    // Turning on needs somewhere to be paid first.
    if (next && !data.account) return setEditing(true);
    save(next, false);
  };
  const showForm = data.eligible && (editing || !data.account);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <CreditCard size={20} color={colors.primary} />
        </View>
        <Text style={styles.title}>Card payments</Text>
        <View style={[styles.pill, { backgroundColor: on ? `${colors.success}1A` : `${colors.textMuted}1A` }]}>
          <Text style={[styles.pillText, { color: on ? colors.success : colors.textMuted }]}>{pill}</Text>
        </View>
      </View>

      <Text style={styles.body}>
        Let buyers pay you by card. Alibe holds their money until they give you their handover code, so they trust you more and you never chase a payment.
      </Text>

      {!data.eligible ? (
        <Text style={styles.muted}>Comes with Premium or a Store plan (see Plans below).</Text>
      ) : (
        <>
          <View style={styles.steps}>
            {[
              "The buyer pays by card on the order (Alibe holds it).",
              "You send the item as usual.",
              `They give you their handover code. ${data.holdDays ? `${data.holdDays} day${data.holdDays === 1 ? "" : "s"} later` : "Then"} Alibe pays you, minus a ${data.feePercent}% card fee.`,
              "If the order is cancelled, the buyer gets their money back.",
            ].map((t, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <Text style={styles.stepText}>{t}</Text>
              </View>
            ))}
          </View>

          {data.mode !== "live" && (
            <View style={styles.note}>
              <AlertTriangle size={16} color={colors.gold} />
              <Text style={styles.noteText}>
                {data.mode === "simulated"
                  ? "Alibe is testing card payments right now, so only Alibe staff can try them. Buyers will see the option once it's live."
                  : "Card payments aren't switched on across Alibe yet. Set this up now and buyers will see it as soon as they are."}
              </Text>
            </View>
          )}

          {showForm ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.label}>Bank account to be paid to</Text>
              <View style={styles.chips}>
                {BANKS.map((b) => (
                  <Tap key={b} style={[styles.chip, bankName === b && styles.chipOn]} onPress={() => setBankName(b)} scaleTo={0.95}>
                    <Text style={[styles.chipText, bankName === b && styles.chipTextOn]}>{b}</Text>
                  </Tap>
                ))}
              </View>
              <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="Name on the account" placeholderTextColor={colors.textMuted} accessibilityLabel="Name on the account" autoCapitalize="words" />
              <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="Account number" placeholderTextColor={colors.textMuted} accessibilityLabel="Account number" keyboardType="number-pad" />
              <Text style={styles.muted}>Use an account in your own (or your store's) name. We'll alert you whenever it changes.</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {data.account && (
                  <Tap style={[styles.button, styles.secondary]} onPress={() => setEditing(false)} scaleTo={0.97}>
                    <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                  </Tap>
                )}
                <Tap style={[styles.button, { flex: 1 }, (saving || !accountName.trim() || accountNumber.replace(/\D/g, "").length < 6) && { opacity: 0.5 }]} onPress={() => save(true, true)} disabled={saving || !accountName.trim() || accountNumber.replace(/\D/g, "").length < 6} scaleTo={0.97}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{data.account ? "Save account" : "Save and turn on"}</Text>}
                </Tap>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.account}>
                <Landmark size={18} color={colors.textMuted} />
                <Text style={styles.accountText} numberOfLines={1}>
                  {data.account!.bankName} · {data.account!.accountName} · {data.account!.accountNumber}
                </Text>
                <Tap onPress={() => (setBankName(data.account!.bankName), setAccountName(data.account!.accountName), setAccountNumber(""), setEditing(true))} scaleTo={0.95}>
                  <Text style={styles.link}>Change</Text>
                </Tap>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>Accept card payments</Text>
                <Switch value={data.on} onValueChange={toggle} disabled={saving} trackColor={{ true: colors.success, false: colors.border }} />
              </View>
            </>
          )}

          {(data.held.count > 0 || data.payoutDue.count > 0 || data.paidOut.count > 0) && (
            <View style={styles.totals}>
              <ShieldCheck size={16} color={colors.success} />
              <Text style={styles.totalsText}>
                Held until delivery: {formatMvr(data.held.payout)} · Due to you: {formatMvr(data.payoutDue.payout)} · Paid to you: {formatMvr(data.paidOut.payout)}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { padding: spacing.md + 4, borderRadius: radius.lg, backgroundColor: colors.card, gap: spacing.sm + 4, ...cardShadow },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  pill: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
  body: { fontSize: fontSize.base, color: colors.text, lineHeight: fontSize.base * 1.45 },
  muted: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: fontSize.sm * 1.45 },
  steps: { gap: spacing.xs + 2 },
  step: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  stepNum: { width: 22, height: 22, borderRadius: 11, overflow: "hidden", textAlign: "center", lineHeight: 22, fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.primary, backgroundColor: colors.primaryTint },
  stepText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: fontSize.sm * 1.5 },
  note: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", padding: spacing.sm + 2, borderRadius: radius.md, backgroundColor: `${colors.gold}14` },
  noteText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: fontSize.sm * 1.45 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  chipTextOn: { color: colors.primary },
  input: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.base, color: colors.text, backgroundColor: colors.background },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  secondary: { backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  buttonText: { color: "#fff", fontSize: fontSize.base, fontWeight: fontWeight.bold },
  account: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm + 4, borderRadius: radius.md, backgroundColor: colors.background },
  accountText: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  switchText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  totals: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", paddingTop: spacing.xs },
  totalsText: { flex: 1, fontSize: fontSize.sm, color: colors.textMuted, lineHeight: fontSize.sm * 1.45 },
}));
