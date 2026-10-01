import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { ShoppingBag } from "lucide-react-native";
import { spacing, fontSize, fontWeight } from "../theme/theme";
import { makeStyles } from "../theme/ThemeContext";

export default function SplashScreen() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <ShoppingBag size={34} color="#fff" />
      </View>
      <Text style={styles.wordmark}>Alibe</Text>
      <ActivityIndicator color="rgba(255,255,255,0.85)" style={{ marginTop: spacing.xl }} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  wordmark: { fontSize: fontSize.display, fontWeight: fontWeight.extrabold, color: "#fff", letterSpacing: 0.5 },
}));
