import React from "react";
import { Text, View } from "react-native";
import { PlanPrices } from "../api/client";
import Tap from "./Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";

const PLANS = [3, 7, 30] as const;

export default function PlanPicker({ prices, days, onChange }: { prices: PlanPrices; days: number; onChange: (days: number) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {PLANS.map((plan) => {
        const active = days === plan;
        return (
          <Tap key={plan} style={[styles.plan, active && { borderColor: colors.primary, backgroundColor: colors.primaryTint }]} onPress={() => onChange(plan)} scaleTo={0.95} accessibilityState={{ selected: active }}>
            <Text style={[styles.days, active && { color: colors.primary }]}>{plan} days</Text>
            <Text style={styles.price}>MVR {prices[String(plan) as keyof PlanPrices].toLocaleString()}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", gap: spacing.sm },
  plan: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  days: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  price: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
}));
