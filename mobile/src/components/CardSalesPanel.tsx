import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import * as Clipboard from "expo-clipboard";
import { AlertTriangle, Copy, RotateCcw, Send, ShieldCheck, CheckCircle2 } from "lucide-react-native";
import { api, CardSale, errorMessage } from "../api/client";
import { useToast } from "./Toast";
import Tap from "./Tap";
import EmptyState from "./EmptyState";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight } from "../theme/theme";

const formatMvr = (n: number) => `MVR ${n.toLocaleString("en-US")}`;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Admin > Payments > Card sales: money from card-paid orders sits in Alibe's
// BML account. Staff refund buyers (cancelled orders, double payments) and pay
// sellers once a delivered sale's hold has passed, recording the bank
// reference each time (backend/src/orderCard.ts).
export default function CardSalesPanel({ onChange }: { onChange?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [sales, setSales] = useState<CardSale[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .cardSales()
      .then((s) => (setSales(s), setError(null)))
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  if (error) return <EmptyState compact icon={AlertTriangle} tone="error" title="Couldn't load card sales" message={error} actionLabel="Try again" onAction={load} />;
  if (!sales) return <ActivityIndicator color={colors.primary} style={{ margin: spacing.xl }} />;

  const refunds = sales.filter((s) => s.status === "REFUND_DUE");
  const payouts = sales.filter((s) => s.status === "PAYOUT_DUE");
  const held = sales.filter((s) => s.status === "HELD");
  const done = sales.filter((s) => s.status === "PAID_OUT" || s.status === "REFUNDED");
  const changed = () => (load(), onChange?.());

  if (!sales.length) {
    return <EmptyState compact icon={ShieldCheck} title="No card sales yet" message="When buyers pay Premium sellers or stores by card, the money to pass on shows here." />;
  }
  return (
    <View style={{ gap: spacing.lg }}>
      <Text style={styles.intro}>
        Card payments for items land in Alibe's BML account. Refund buyers when an order is cancelled, and pay sellers once a delivered sale's hold has passed. Record the bank reference each time.
      </Text>
      <Group title="Refund the buyer" empty="No refunds waiting." items={refunds} render={(s) => <SaleRow key={s.id} sale={s} onDone={changed} />} />
      <Group title="Pay the seller" empty="No payouts waiting." items={payouts} render={(s) => <SaleRow key={s.id} sale={s} onDone={changed} />} />
      <Group title="Held until delivery" empty="Nothing held right now." items={held} render={(s) => <SaleRow key={s.id} sale={s} onDone={changed} />} />
      {done.length > 0 && <Group title="Done (last 30 days)" items={done} render={(s) => <SaleRow key={s.id} sale={s} onDone={changed} />} />}
    </View>
  );
}

function Group({ title, empty, items, render }: { title: string; empty?: string; items: CardSale[]; render: (s: CardSale) => React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.groupTitle}>
        {title} {items.length > 0 && <Text style={styles.count}>({items.length})</Text>}
      </Text>
      {items.length ? items.map(render) : <Text style={styles.muted}>{empty}</Text>}
    </View>
  );
}

function SaleRow({ sale, onDone }: { sale: CardSale; onDone: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const refund = sale.status === "REFUND_DUE";
  const payout = sale.status === "PAYOUT_DUE";
  const notYet = payout && !!sale.payoutDueAt && new Date(sale.payoutDueAt) > new Date();
  const acc = sale.payoutAccount;

  const copy = async (v: string) => {
    await Clipboard.setStringAsync(v);
    toast.success("Copied");
  };
  const settle = async () => {
    setBusy(true);
    try {
      await api.settleCardSale(sale.id, refund ? "refunded" : "paid-out", note.trim());
      toast.success(refund ? "Marked as refunded. The buyer has been told." : "Marked as paid. The seller has been told.");
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {sale.order.title}
        </Text>
        {sale.test && (
          <View style={styles.testPill}>
            <Text style={styles.testText}>TEST</Text>
          </View>
        )}
      </View>
      <Text style={styles.line}>
        {formatMvr(sale.amount)} paid by {sale.buyer?.name ?? "buyer"}
        {sale.paidAt ? ` on ${when(sale.paidAt)}` : ""} · ref {sale.reference}
      </Text>

      {refund && (
        <View style={styles.box}>
          <RotateCcw size={16} color={colors.textMuted} />
          <Text style={styles.boxText}>
            Refund {formatMvr(sale.amount)} to {sale.buyer?.name ?? "the buyer"}
. {sale.refundReason ? `Why: ${sale.refundReason}` : ""} Refund it in the BML merchant portal{sale.test ? " (test payment: no real money, just mark it done)" : ""}.
          </Text>
        </View>
      )}

      {(payout || sale.status === "HELD") && (
        <View style={styles.box}>
          <Send size={16} color={colors.textMuted} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.boxText}>
              {sale.status === "HELD"
                ? `Seller gets ${formatMvr(sale.payout)} after delivery (fee ${formatMvr(sale.fee)}).`
                : notYet
                ? `Pay ${sale.seller?.name ?? "the seller"} ${formatMvr(sale.payout)} from ${when(sale.payoutDueAt!)} (hold for chargebacks).`
                : `Pay ${sale.seller?.name ?? "the seller"} ${formatMvr(sale.payout)} (Alibe keeps ${formatMvr(sale.fee)}).`}
            </Text>
            {payout && acc && (
              <View style={styles.accountRow}>
                <Text style={styles.account} selectable>
                  {acc.bankName} · {acc.accountName} · {acc.accountNumber}
                </Text>
                <Tap onPress={() => copy(acc.accountNumber)} scaleTo={0.9} accessibilityLabel="Copy account number">
                  <Copy size={16} color={colors.primary} />
                </Tap>
              </View>
            )}
          </View>
        </View>
      )}

      {payout && acc?.changedRecently && (
        <View style={[styles.box, { backgroundColor: `${colors.danger}12` }]}>
          <AlertTriangle size={16} color={colors.danger} />
          <Text style={styles.boxText}>
            Bank details changed on {when(acc.changedAt)}. Call {sale.seller?.name ?? "the seller"}
            {sale.seller?.phone ? ` (${sale.seller.phone})` : ""} to confirm before paying to a new account.
          </Text>
        </View>
      )}

      {(sale.status === "PAID_OUT" || sale.status === "REFUNDED") && (
        <View style={styles.box}>
          <CheckCircle2 size={16} color={colors.success} />
          <Text style={styles.boxText}>
            {sale.status === "PAID_OUT" ? `Paid ${formatMvr(sale.payout)} to the seller` : `Refunded ${formatMvr(sale.amount)} to the buyer`}
            {sale.settledAt ? ` on ${when(sale.settledAt)}` : ""}. Ref: {sale.settleNote}
          </Text>
        </View>
      )}

      {(refund || (payout && !notYet)) && (
        <View style={styles.actionRow}>
          <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder={refund ? "Refund reference" : "Transfer reference"} placeholderTextColor={colors.textMuted} accessibilityLabel="Bank reference" />
          <Tap style={[styles.button, (busy || note.trim().length < 3) && { opacity: 0.5 }]} onPress={settle} disabled={busy || note.trim().length < 3} scaleTo={0.97}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{refund ? "Mark refunded" : "Mark paid"}</Text>}
          </Tap>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  intro: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: fontSize.sm * 1.5 },
  groupTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  count: { color: colors.textMuted, fontWeight: fontWeight.semibold },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  row: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, gap: spacing.sm, ...cardShadow },
  rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowTitle: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  testPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.gold },
  testText: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: "#fff" },
  line: { fontSize: fontSize.sm, color: colors.textMuted },
  box: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", padding: spacing.sm + 2, borderRadius: radius.md, backgroundColor: colors.background },
  boxText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: fontSize.sm * 1.45 },
  accountRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  account: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  actionRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  input: { flexGrow: 1, flexBasis: 180, height: controlHeight.secondary, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.base, color: colors.text, backgroundColor: colors.background },
  button: { height: controlHeight.secondary, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontSize: fontSize.base, fontWeight: fontWeight.bold },
}));
