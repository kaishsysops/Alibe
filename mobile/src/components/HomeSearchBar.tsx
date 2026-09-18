import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Search } from "lucide-react-native";
import { colors, spacing, radius } from "../theme/theme";

export default function HomeSearchBar({
  onSubmit,
  style,
}: {
  onSubmit: (query: string) => void;
  style?: object;
}) {
  const [query, setQuery] = useState("");

  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
      <Search size={18} color={colors.textMuted} style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder="Search for anything..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => onSubmit(query)}
        returnKeyType="search"
      />
      <TouchableOpacity style={styles.button} onPress={() => onSubmit(query)}>
        <Search size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    height: 50,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  icon: { marginLeft: spacing.md },
  input: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    color: colors.text,
    outlineStyle: "none" as any,
  },
  button: {
    width: 46,
    height: "100%",
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
