import React from "react";
import { View, Text, TextInput } from "react-native";
import { Lock, IdCard, ScanFace } from "lucide-react-native";
import type { IdPhotos } from "../api/client";
import PhotoSlot from "./PhotoSlot";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, controlHeight } from "../theme/theme";

export type IdDraft = { idNumber: string; idFront: string | null; idBack: string | null; selfie: string | null };
export const emptyId: IdDraft = { idNumber: "", idFront: null, idBack: null, selfie: null };
export const idReady = (d: IdDraft) => d.idNumber.trim().length >= 5 && !!d.idFront && !!d.selfie;
export const idPayload = (d: IdDraft): IdPhotos => ({ idNumber: d.idNumber.trim(), idFront: d.idFront!, ...(d.idBack ? { idBack: d.idBack } : {}), selfie: d.selfie! });

// ID number, the card's photos and a selfie holding it. Shared by the
// "Verify your identity" and "Register a store" screens.
export default function IdForm({ value, onChange }: { value: IdDraft; onChange: (d: IdDraft) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View>
        <Text style={styles.label}>ID card or passport number</Text>
        <TextInput
          style={styles.input}
          value={value.idNumber}
          onChangeText={(idNumber) => onChange({ ...value, idNumber: idNumber.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) })}
          placeholder="A123456"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="ID card or passport number"
        />
      </View>
      <View style={styles.row}>
        <PhotoSlot label="Front of ID" value={value.idFront} onChange={(idFront) => onChange({ ...value, idFront })} Icon={IdCard} />
        <PhotoSlot label="Back of ID" hint="Optional" value={value.idBack} onChange={(idBack) => onChange({ ...value, idBack })} Icon={IdCard} />
      </View>
      <View style={styles.row}>
        <PhotoSlot label="Selfie holding your ID" hint="Your face and the card both clear" value={value.selfie} onChange={(selfie) => onChange({ ...value, selfie })} Icon={ScanFace} camera />
        <View style={{ flex: 1, minWidth: 140 }} />
      </View>
      <View style={styles.privacy}>
        <Lock size={15} color={colors.success} />
        <Text style={styles.privacyText}>Only Alibe's approval team sees these photos, and they're deleted as soon as a decision is made. We keep just the last 4 characters of your ID number.</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 6 },
  input: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.background, letterSpacing: 1, fontWeight: fontWeight.semibold, outlineStyle: "none" as any },
  row: { flexDirection: "row", gap: spacing.sm + 4, flexWrap: "wrap" },
  privacy: { flexDirection: "row", gap: spacing.sm, padding: spacing.sm + 4, borderRadius: radius.md, backgroundColor: `${colors.success}12` },
  privacyText: { flex: 1, fontSize: fontSize.caption, lineHeight: 17, color: colors.text },
}));
