import React, { useState } from "react";
import { View, TextInput } from "react-native";
import { Search, ArrowRight } from "lucide-react-native";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize } from "../theme/theme";
import Tap from "./Tap";

export default function HomeSearchBar({ onSubmit, style }: { onSubmit: (query: string) => void; style?: object }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const submit = () => query.trim() && onSubmit(query.trim());

  return (
    <View style={[styles.wrap, style]}>
      <Search size={18} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        placeholder="Search phones, sofas, bikes..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={submit}
        returnKeyType="search"
        accessibilityLabel="Search listings"
      />
      {query.trim().length > 0 && (
        <Tap style={styles.button} onPress={submit} hitSlop={8} scaleTo={0.88} accessibilityLabel="Search">
          <ArrowRight size={17} color="#fff" />
        </Tap>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    height: 50,
    paddingLeft: spacing.md,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    outlineStyle: "none" as any,
  },
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
}));
