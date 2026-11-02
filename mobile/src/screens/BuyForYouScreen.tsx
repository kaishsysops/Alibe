import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api, errorMessage, IbayItemDetail, newClientId } from "../api/client";
import { useAuth, DRAFT_PREFIX } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { usePersistentState } from "../hooks/usePersistentState";
import { formatPhone } from "../utils/phone";

export default function BuyForYouScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuth();
  const { isDesktopWeb } = useResponsive();
  const id: string = route.params.id;
  const [item, setItem] = useState<IbayItemDetail | null>(null);
  const [draft, setDraft] = usePersistentState(`${DRAFT_PREFIX}buyforyou.${user?.id}`, { deliveryNote: "", contactPhone: formatPhone(user?.phone) });
  const clientId = useRef(newClientId());

  useEffect(() => {
    api.ibayItem(id).then(setItem).catch((e) => toast.error(errorMessage(e, "This item is no longer available.")));
  }, [id, toast]);

  const canSend = draft.deliveryNote.trim().length >= 5 && draft.contactPhone.trim().length >= 7;

  const [send, sending] = useSingleFlight(async () => {
    if (!canSend) return toast.error("Please tell us where to deliver it and how to reach you.");
    try {
      await api.createPurchase({ kind: "BUY_FOR_YOU", ibayItemId: id, deliveryNote: draft.deliveryNote.trim(), contactPhone: draft.contactPhone.trim() }, clientId.current);
      setDraft((d) => ({ ...d, deliveryNote: "" }));
      toast.success("Request sent. We'll check with the seller first.");
      navigation.replace("Purchases");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title="Buy through Alibe" />}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!item ? (
            <SkeletonGroup>
              <Skeleton width="100%" height={150} rounded={radius.lg} />
            </SkeletonGroup>
          ) : (
            <View style={styles.card}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.line}>
                <Text style={styles.lineLabel}>Alibe price, service included</Text>
                <Text style={styles.lineValue}>{item.price ? `MVR ${item.price.toLocaleString()}` : "We'll tell you"}</Text>
              </View>
              <View style={styles.line}>
                <Text style={styles.lineLabel}>Delivery</Text>
                <Text style={styles.lineValue}>We'll tell you</Text>
              </View>
            </View>
          )}

          <Text style={styles.heading}>How it works</Text>
          <Text style={styles.step}>1. We check it's still available and tell you the final total, with delivery.</Text>
          <Text style={styles.step}>2. You pay Alibe by bank transfer. You pay nothing before this.</Text>
          <Text style={styles.step}>3. We get it and deliver it to you.</Text>

          <Text style={styles.label}>Where should we deliver it?</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={draft.deliveryNote}
            onChangeText={(deliveryNote) => setDraft((d) => ({ ...d, deliveryNote }))}
            placeholder="Your island, address or ferry details"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={300}
            accessibilityLabel="Delivery details"
          />
          <Text style={styles.label}>Phone number</Text>
          <TextInput style={styles.input} value={draft.contactPhone} onChangeText={(contactPhone) => setDraft((d) => ({ ...d, contactPhone }))} placeholder="777 1234" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" accessibilityLabel="Phone number" maxLength={20} />

          <Tap style={[styles.button, !canSend && { opacity: 0.45 }]} onPress={() => send()} disabled={sending} scaleTo={0.97}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send request</Text>}
          </Tap>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: contentWidth.form, alignSelf: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  itemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  lineLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  lineValue: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.xs },
  step: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs, lineHeight: fontSize.md * 1.35 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: controlHeight.input, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  area: { minHeight: 90, paddingTop: spacing.sm + 4, textAlignVertical: "top" },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
}));
