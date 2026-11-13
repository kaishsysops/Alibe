import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, Linking } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Scale, ImagePlus, X, CheckCircle2, XCircle } from "lucide-react-native";
import { api, DisputeInfo, errorMessage, mediaUrl, uploadMedia } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "./Toast";
import { useAppAlert } from "./AppAlertProvider";
import Tap from "./Tap";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { timeAgo } from "../utils/time";

// A disputed order: what the buyer reported, then each side's evidence, then
// staff's decision. Buyer and seller can add evidence (text and a photo) while
// it's open; staff see two buttons to settle it.
export default function DisputePanel({ orderId, staff, onSettled }: { orderId: string; staff?: boolean; onSettled?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const showAlert = useAppAlert();
  const [info, setInfo] = useState<DisputeInfo | null>(null);
  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [note, setNote] = useState("");

  const load = useCallback(() => api.orderDispute(orderId).then(setInfo).catch(() => {}), [orderId]);
  useEffect(() => {
    load();
  }, [load]);

  const [addPhoto, uploading] = useSingleFlight(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return toast.error("Please allow photo access to add a photo.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled) return;
    try {
      setPhotoUrl((await uploadMedia(result.assets[0].uri, result.assets[0].mimeType ?? "image/jpeg")).url);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't upload that photo."));
    }
  });

  const [send, sending] = useSingleFlight(async () => {
    if (!user || text.trim().length < 3) return;
    try {
      await api.addDisputeEvidence(orderId, user.id, text.trim(), photoUrl);
      setText("");
      setPhotoUrl(undefined);
      toast.success("Added. Staff and the other side can see it.");
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const [settle, settling] = useSingleFlight(async (outcome: "DELIVERED" | "CANCELLED") => {
    try {
      await api.resolveDispute(orderId, outcome, note.trim());
      toast.success("Dispute settled. Both sides have been told.");
      load();
      onSettled?.();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });
  const confirmSettle = (outcome: "DELIVERED" | "CANCELLED") => {
    if (note.trim().length < 3) return toast.error("Add a short note explaining the decision. Both sides will see it.");
    showAlert({
      title: outcome === "DELIVERED" ? "The sale stands?" : "Cancel and refund the buyer?",
      message: outcome === "DELIVERED" ? "The order is marked delivered. The buyer is told the seller keeps the payment." : "The order is cancelled. The buyer is told they should get their money back from the seller.",
      kind: "info",
      buttons: [{ text: "Back", style: "cancel" }, { text: "Settle", onPress: () => settle(outcome) }],
    });
  };

  if (!info) return <ActivityIndicator color={colors.primary} style={{ margin: spacing.lg }} />;
  const open = info.status === "DISPUTED";
  const roleLabel = { BUYER: "Buyer", SELLER: "Seller", STAFF: "Alibe staff" } as const;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Scale size={20} color={colors.primary} />
        <Text style={styles.title}>{open ? "Dispute" : "Dispute settled"}</Text>
      </View>
      <Text style={styles.lead}>{open ? "Add what happened, with photos if you have them. Alibe staff read both sides and decide." : "Alibe staff looked at both sides."}</Text>

      {!!info.problem && (
        <View style={styles.entry}>
          <Text style={styles.entryWho}>Buyer reported</Text>
          <Text style={styles.entryText}>{info.problem}</Text>
        </View>
      )}
      {info.evidence.map((e) => (
        <View key={e.id} style={[styles.entry, e.by.id === user?.id && styles.entryMine]}>
          <Text style={styles.entryWho}>
            {roleLabel[e.role]} · {e.by.name} · {timeAgo(e.createdAt, true)}
          </Text>
          <Text style={styles.entryText}>{e.text}</Text>
          {!!e.photoUrl && (
            <Tap onPress={() => Linking.openURL(mediaUrl(e.photoUrl) ?? "").catch(() => {})} scaleTo={0.97} accessibilityLabel="Open photo">
              <Image source={{ uri: mediaUrl(e.photoUrl) }} style={styles.photo} contentFit="cover" />
            </Tap>
          )}
        </View>
      ))}

      {!open && info.outcome && (
        <View style={[styles.outcome, { backgroundColor: info.outcome === "DELIVERED" ? `${colors.success}18` : `${colors.danger}14` }]}>
          {info.outcome === "DELIVERED" ? <CheckCircle2 size={18} color={colors.success} /> : <XCircle size={18} color={colors.danger} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.outcomeTitle}>{info.outcome === "DELIVERED" ? "The sale stands" : "Cancelled: the buyer should be refunded"}</Text>
            {!!info.note && <Text style={styles.entryText}>{info.note}</Text>}
          </View>
        </View>
      )}

      {open && !staff && (
        <View style={styles.form}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="What happened? Dates, what you agreed, what arrived..." placeholderTextColor={colors.textMuted} multiline maxLength={1000} />
          {photoUrl ? (
            <View>
              <Image source={{ uri: mediaUrl(photoUrl) }} style={styles.photo} contentFit="cover" />
              <Tap style={styles.removePhoto} onPress={() => setPhotoUrl(undefined)} scaleTo={0.9} accessibilityLabel="Remove photo">
                <X size={14} color="#fff" />
              </Tap>
            </View>
          ) : (
            <Tap style={styles.photoButton} onPress={addPhoto} disabled={uploading} scaleTo={0.96}>
              {uploading ? <ActivityIndicator color={colors.primary} /> : <ImagePlus size={16} color={colors.primary} />}
              <Text style={styles.photoButtonText}>Add a photo</Text>
            </Tap>
          )}
          <Tap style={[styles.primary, text.trim().length < 3 && { opacity: 0.45 }]} onPress={() => send()} disabled={sending || text.trim().length < 3} scaleTo={0.97}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Add to the dispute</Text>}
          </Tap>
        </View>
      )}

      {open && staff && (
        <View style={styles.form}>
          <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Decision note (both sides see it)" placeholderTextColor={colors.textMuted} multiline maxLength={500} />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Tap style={[styles.primary, { flex: 1, backgroundColor: colors.success }]} onPress={() => confirmSettle("DELIVERED")} disabled={settling} scaleTo={0.97}>
              <Text style={styles.primaryText}>Sale stands</Text>
            </Tap>
            <Tap style={[styles.primary, { flex: 1, backgroundColor: colors.danger }]} onPress={() => confirmSettle("CANCELLED")} disabled={settling} scaleTo={0.97}>
              <Text style={styles.primaryText}>Refund buyer</Text>
            </Tap>
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  lead: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs },
  entry: { borderRadius: radius.md, backgroundColor: colors.background, padding: spacing.sm + 4, gap: 4 },
  entryMine: { backgroundColor: colors.primaryTint },
  entryWho: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted },
  entryText: { fontSize: fontSize.base, color: colors.text, lineHeight: 20 },
  photo: { width: 140, height: 105, borderRadius: radius.md, marginTop: 4 },
  outcome: { flexDirection: "row", gap: spacing.sm, padding: spacing.sm + 4, borderRadius: radius.md },
  outcomeTitle: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: 2 },
  form: { gap: spacing.sm, marginTop: spacing.xs },
  input: { minHeight: 84, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm + 4, fontSize: fontSize.base, color: colors.text, backgroundColor: colors.background, textAlignVertical: "top", outlineStyle: "none" as any },
  photoButton: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  photoButtonText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  removePhoto: { position: "absolute", top: 8, left: 112, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  primary: { height: 46, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
}));
