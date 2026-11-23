import React, { useState } from "react";
import { View, Text, TextInput, Modal, Pressable, ActivityIndicator } from "react-native";
import { api, errorMessage } from "../api/client";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, controlHeight, cardShadow } from "../theme/theme";

// Staff change their own password from the console sidebar. Their other
// staff sign-ins end; this one stays.
export default function ChangePassword({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");

  const close = () => {
    setCurrent("");
    setNext("");
    setAgain("");
    onClose();
  };

  const [save, saving] = useSingleFlight(async () => {
    if (next.length < 10) return toast.error("The new password needs at least 10 characters.");
    if (next !== again) return toast.error("The two new passwords don't match.");
    try {
      await api.changeStaffPassword(current, next);
      toast.success("Password changed. Other devices are signed out.");
      close();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const field = (label: string, value: string, onChange: (t: string) => void, auto: "current-password" | "new-password") => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={auto} accessibilityLabel={label} maxLength={200} placeholderTextColor={colors.textMuted} />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Change your password</Text>
          {field("Current password", current, setCurrent, "current-password")}
          {field("New password (10+ characters)", next, setNext, "new-password")}
          {field("New password again", again, setAgain, "new-password")}
          <View style={styles.actions}>
            <Tap style={[styles.button, styles.secondary]} onPress={close} scaleTo={0.97}>
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
            </Tap>
            <Tap style={styles.button} onPress={() => save()} disabled={saving} scaleTo={0.97}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Change</Text>}
            </Tap>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: { width: "100%", maxWidth: 400, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, ...cardShadow },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 6 },
  input: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.background, outlineStyle: "none" as any },
  actions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", marginTop: spacing.xs },
  button: { minWidth: 110, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  secondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
}));
