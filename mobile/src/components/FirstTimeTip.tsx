import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Lightbulb, X } from "lucide-react-native";
import { useAuth } from "../api/AuthContext";
import Tap from "./Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import type { HelpTopicKey } from "../help/topics";

// A tip shown the first time someone opens a screen, with a link to the help
// topic. Dismissed for good per account (stored on the device).
export default function FirstTimeTip({ id, title, text, topic, style }: { id: string; title: string; text: string; topic?: HelpTopicKey; style?: object }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const key = `alibe.tip.${id}.${user?.id ?? "guest"}`;
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((v) => alive && setShow(!v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  if (!show) return null;
  const dismiss = () => {
    setShow(false);
    AsyncStorage.setItem(key, "1").catch(() => {});
  };

  return (
    <View style={[styles.card, style]} accessibilityRole="summary">
      <View style={styles.icon}>
        <Lightbulb size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
        <View style={styles.actions}>
          <Tap onPress={dismiss} scaleTo={0.96} style={styles.gotIt}>
            <Text style={styles.gotItText}>Got it</Text>
          </Tap>
          {topic && (
            <Tap onPress={() => (dismiss(), navigation.navigate("Help", { topic }))} scaleTo={0.96}>
              <Text style={styles.more}>Learn more</Text>
            </Tap>
          )}
        </View>
      </View>
      <Tap onPress={dismiss} hitSlop={10} scaleTo={0.9} accessibilityLabel="Dismiss tip">
        <X size={16} color={colors.textMuted} />
      </Tap>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { flexDirection: "row", gap: spacing.sm + 2, alignItems: "flex-start", padding: spacing.sm + 4, borderRadius: radius.lg, backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: `${colors.primary}33` },
  icon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: colors.text },
  text: { fontSize: fontSize.sm, color: colors.text, lineHeight: 19 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 6 },
  gotIt: { paddingHorizontal: 14, height: 30, borderRadius: 15, backgroundColor: colors.primary, justifyContent: "center" },
  gotItText: { color: "#fff", fontSize: fontSize.caption, fontWeight: fontWeight.extrabold },
  more: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
}));
