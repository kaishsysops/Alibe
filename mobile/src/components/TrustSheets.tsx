import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { Flag, Ban, ShieldAlert, PackageX, Tags, MessageCircleWarning, HelpCircle, Star } from "lucide-react-native";
import { api, errorMessage, PublicSeller, ReportReason } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { useAppAlert } from "./AppAlertProvider";
import { useActionSheet, Sheet } from "./Sheet";
import { useToast } from "./Toast";
import Tap from "./Tap";

const REASONS: Array<{ reason: ReportReason; label: string; icon: any }> = [
  { reason: "SCAM", label: "Scam or fraud", icon: ShieldAlert },
  { reason: "PROHIBITED", label: "Prohibited item", icon: PackageX },
  { reason: "WRONG_CATEGORY", label: "Wrong category or misleading", icon: Tags },
  { reason: "OFFENSIVE", label: "Offensive or abusive", icon: MessageCircleWarning },
  { reason: "OTHER", label: "Something else", icon: HelpCircle },
];

// Report and block actions, shared by product, seller and chat screens.
export function useTrustActions() {
  const { user } = useAuth();
  const toast = useToast();
  const showSheet = useActionSheet();
  const showAlert = useAppAlert();

  const [sendReport] = useSingleFlight(async (target: { listingId?: string; reportedUserId?: string }, reason: ReportReason) => {
    if (!user) return;
    try {
      await api.report({ reporterId: user.id, ...target, reason });
      toast.success("Thanks. Our team will review this report.");
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't send the report. Please try again."));
    }
  });

  const report = (target: { listingId?: string; reportedUserId?: string }) =>
    showSheet({
      title: target.listingId ? "Report this listing" : "Report this user",
      actions: REASONS.map((r) => ({ label: r.label, icon: r.icon, onPress: () => sendReport(target, r.reason) })),
    });

  const [doBlock] = useSingleFlight(async (other: PublicSeller, onDone?: () => void) => {
    if (!user) return;
    try {
      await api.block(user.id, other.id);
      toast.success(`${other.name} is blocked. You won't see their listings or messages.`);
      onDone?.();
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't block this user."));
    }
  });

  const block = (other: PublicSeller, onDone?: () => void) =>
    showAlert({
      title: `Block ${other.name}?`,
      message: "They won't be able to message you, and you won't see each other's listings. You can unblock them from your profile.",
      kind: "warning",
      buttons: [{ text: "Cancel", style: "cancel" }, { text: "Block", style: "destructive", onPress: () => doBlock(other, onDone) }],
    });

  return { report, block, reportIcon: Flag, blockIcon: Ban };
}

export function OfferSheet({
  visible,
  onClose,
  listingPrice,
  title,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  listingPrice: number;
  title: string;
  onSubmit: (amount: number) => Promise<void>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [amount, setAmount] = useState("");
  useEffect(() => {
    if (visible) setAmount(String(Math.round((listingPrice * 0.9) / 50) * 50 || ""));
  }, [visible, listingPrice]);
  const value = Number(amount);
  const [submit, busy] = useSingleFlight(async () => {
    if (!value) return;
    await onSubmit(value);
  });
  const quick = [0.95, 0.9, 0.85].map((f) => Math.max(50, Math.round((listingPrice * f) / 50) * 50));

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        <Text style={styles.label}>Your offer</Text>
        <View style={styles.amountField}>
          <Text style={styles.currency}>MVR</Text>
          <TextInput style={styles.amountInput} value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ""))} keyboardType="number-pad" autoFocus maxLength={9} placeholderTextColor={colors.textMuted} placeholder="0" accessibilityLabel="Offer amount" />
        </View>
        <Text style={styles.helper}>Asking price MVR {listingPrice.toLocaleString()}</Text>
        <View style={styles.quickRow}>
          {quick.map((q) => (
            <Tap key={q} style={[styles.quick, value === q && styles.quickActive]} onPress={() => setAmount(String(q))} scaleTo={0.92}>
              <Text style={[styles.quickText, value === q && { color: colors.primary }]}>{q.toLocaleString()}</Text>
            </Tap>
          ))}
        </View>
        <Tap style={[styles.primary, !value && { opacity: 0.45 }]} onPress={() => submit()} disabled={busy || !value}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Send offer</Text>}
        </Tap>
      </View>
    </Sheet>
  );
}

export function ReviewSheet({ visible, onClose, listingId, sellerName }: { visible: boolean; onClose: () => void; listingId: string; sellerName: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!visible || !user) return;
    api
      .reviewEligibility(user.id, listingId)
      .then((r) => {
        if (r.existing) {
          setRating(r.existing.rating);
          setText(r.existing.text ?? "");
        }
      })
      .catch(() => {});
  }, [visible, user, listingId]);

  const [submit, busy] = useSingleFlight(async () => {
    if (!user || !rating) return;
    try {
      await api.submitReview({ reviewerId: user.id, listingId, rating, text: text.trim() || null });
      toast.success("Thanks for your review.");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save your review."));
    }
  });

  return (
    <Sheet visible={visible} onClose={onClose} title={`Rate ${sellerName}`}>
      <View style={styles.body}>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Tap key={i} onPress={() => setRating(i)} scaleTo={0.8} accessibilityLabel={`${i} star${i > 1 ? "s" : ""}`} hitSlop={6}>
              <Star size={36} color={colors.gold} fill={rating >= i ? colors.gold : "transparent"} />
            </Tap>
          ))}
        </View>
        <Text style={styles.label}>Review (optional)</Text>
        <TextInput
          style={styles.textArea}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          placeholder="How was the item and the handover?"
          placeholderTextColor={colors.textMuted}
        />
        <Tap style={[styles.primary, !rating && { opacity: 0.45 }]} onPress={() => submit()} disabled={busy || !rating}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit review</Text>}
        </Tap>
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.sm },
  amountField: { flexDirection: "row", alignItems: "center", height: 60, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  currency: { fontSize: fontSize.lg, color: colors.textMuted, fontWeight: fontWeight.semibold, marginRight: spacing.sm },
  amountInput: { flex: 1, height: "100%", fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, outlineStyle: "none" as any },
  helper: { fontSize: fontSize.caption, color: colors.textMuted },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quick: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  quickActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  quickText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  primary: { height: 52, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  primaryText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
  starRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  textArea: { minHeight: 96, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: spacing.sm + 4, fontSize: fontSize.base, color: colors.text, textAlignVertical: "top", outlineStyle: "none" as any },
}));
