import React from "react";
import { Animated, StyleProp, Text, TextInput, View, ViewStyle } from "react-native";
import Tap from "./Tap";
import { Pop } from "./Motion";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";

export const CODE_LENGTH = 6;

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
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        style={styles.hidden}
      />
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  box: { flex: 1, maxWidth: 56, height: 62, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  boxActive: { borderColor: colors.primary },
  boxFilled: { backgroundColor: colors.primaryTint, borderColor: colors.primaryLight },
  digit: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
}));
