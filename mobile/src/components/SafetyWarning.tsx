import React from "react";
import { Text, View } from "react-native";
import { ShieldAlert } from "lucide-react-native";
import { MessageFlag } from "../api/client";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { FadeIn } from "./Motion";
import Tap from "./Tap";

// Plain-language warnings shown under chat messages the server flagged as a
// likely scam pattern (see backend/src/safety.ts). Most are shown to the
// person *receiving* the message; HANDOVER_CODE is shown to the sender.
const COPY: Record<MessageFlag, { title: string; text: string }> = {
  PAY_FIRST: {
    title: "Don't pay before you have the item",
    text: "Asking for money first is the most common scam. Only pay when the item is in your hands.",
  },
  GIFT_CARD_CRYPTO: {
    title: "Gift cards and crypto can't be refunded",
    text: "Scammers ask for them for that reason. Pay with cash or bank transfer at handover.",
  },
  LINK: {
    title: "Be careful with links",
    text: "Links in chats can lead to fake bank pages. Never type your bank or login details after opening one.",
  },
  BANK_DETAILS: {
    title: "No sale agreed yet",
    text: "Don't send money until the seller accepts your offer and the item is in your hands.",
  },
  HANDOVER_CODE: {
    title: "You shared your secret code early",
    text: "Make a new code now so this one can't be used before you get the item.",
  },
};

export function shouldShowWarning(flag: MessageFlag | null | undefined, mine: boolean) {
  if (!flag) return false;
  return flag === "HANDOVER_CODE" ? mine : !mine;
}

export default function SafetyWarning({
  flag,
  actionLabel,
  onAction,
}: {
  flag: MessageFlag;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const copy = COPY[flag];
  return (
    <FadeIn style={styles.card}>
      <View style={styles.head}>
        <ShieldAlert size={18} color={colors.gold} />
        <Text style={styles.title}>{copy.title}</Text>
      </View>
      <Text style={styles.text}>{copy.text}</Text>
      {!!actionLabel && (
        <Tap style={styles.action} onPress={onAction} scaleTo={0.95}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Tap>
      )}
    </FadeIn>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { marginTop: 6, padding: spacing.sm + 4, borderRadius: radius.md, backgroundColor: `${colors.gold}1F`, borderWidth: 1, borderColor: `${colors.gold}55`, maxWidth: 320 },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  text: { fontSize: fontSize.sm, color: colors.text, marginTop: 4, lineHeight: fontSize.sm * 1.45 },
  action: { alignSelf: "flex-start", marginTop: spacing.sm, paddingHorizontal: spacing.sm + 4, height: 34, borderRadius: radius.pill, justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: `${colors.gold}88` },
  actionText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
}));
