import React from "react";
import { View, Text } from "react-native";
import { BadgePercent } from "lucide-react-native";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";

// "Eid offer: 20% off" strip shown where a discount applies.
export default function DiscountRibbon({ label, percent }: { label: string; percent: number }) {
  const styles = useStyles();
  return (
    <View style={styles.ribbon}>
      <BadgePercent size={18} color="#fff" />
      <Text style={styles.text}>
        {label}: {percent}% off
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  ribbon: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "stretch", paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radius.lg, backgroundColor: colors.success },
  text: { color: "#fff", fontSize: fontSize.base, fontWeight: fontWeight.extrabold },
}));
