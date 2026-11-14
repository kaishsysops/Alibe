import React from "react";
import { Animated, StyleProp, Text, TextInput, View, ViewStyle } from "react-native";
import * as Clipboard from "expo-clipboard";
import { ClipboardPaste } from "lucide-react-native";
import Tap from "./Tap";
import { useToast } from "./Toast";
import { Pop } from "./Motion";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";

export const CODE_LENGTH = 6;

// Pulls the code out of whatever was typed or pasted. Copying from an email
// often brings spaces, line breaks or the whole sentence along, so prefer a
// standalone run of exactly 6 digits; otherwise keep the last 6 digits (a paste
// lands after anything already typed).
export function extractCode(text: string): string {
  const exact = text.match(new RegExp(`(?:^|\\D)(\\d{${CODE_LENGTH}})(?!\\d)`));
  if (exact) return exact[1];
  const digits = text.replace(/\D/g, "");
  return digits.length > CODE_LENGTH ? digits.slice(-CODE_LENGTH) : digits;
}

type Props = {
  value: string;
  onChange: (digits: string) => void;
  inputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  // Lets the screen play useShake() on a wrong code.
  animatedStyle?: StyleProp<ViewStyle>;
};

// One box per digit, with a hidden input behind them so the keyboard and the
// phone's "fill from messages" suggestion both work.
export default function CodeBoxes({ value, onChange, inputRef, animatedStyle }: Props) {
  const styles = useStyles();
  const toast = useToast();

  const paste = async () => {
    const text = await Clipboard.getStringAsync().catch(() => "");
    const code = extractCode(text);
    if (code.length !== CODE_LENGTH) {
      toast.info("No code copied yet. Copy the 6 numbers from the email, then tap Paste.");
      return;
    }
    onChange(code);
  };

  return (
    <Animated.View style={animatedStyle}>
      <Tap style={styles.row} onPress={() => inputRef.current?.focus()} scaleTo={1} accessibilityLabel="Enter your code">
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.box, i === value.length && styles.boxActive, i < value.length && styles.boxFilled]}>
            {value[i] ? (
              <Pop key={`${i}-${value[i]}`} from={0.5}>
                <Text style={styles.digit}>{value[i]}</Text>
              </Pop>
            ) : null}
          </View>
        ))}
      </Tap>
      <TextInput
        ref={inputRef}
        value={value}
        // No maxLength: it would cut a pasted " 123456" down to " 12345"
        // before the spaces are stripped.
        onChangeText={(t) => {
          // Already full and one more key typed: ignore it rather than shifting.
          if (value.length === CODE_LENGTH && t.length === value.length + 1) return;
          onChange(extractCode(t));
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        style={styles.hidden}
      />
      {value.length < CODE_LENGTH && (
        <Tap style={styles.paste} onPress={paste} scaleTo={0.95} accessibilityRole="button" accessibilityLabel="Paste code">
          <ClipboardPaste size={20} color={styles.pasteText.color as string} strokeWidth={2.2} />
          <Text style={styles.pasteText}>Paste code</Text>
        </Tap>
      )}
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  box: { flex: 1, maxWidth: 56, height: 62, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  boxActive: { borderColor: colors.primary },
  boxFilled: { backgroundColor: colors.primaryTint, borderColor: colors.primaryLight },
  digit: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  paste: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, alignSelf: "center", marginTop: spacing.md, minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  pasteText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.primary },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
}));
