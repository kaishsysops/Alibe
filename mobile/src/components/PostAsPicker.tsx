import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Store, User, Check } from "lucide-react-native";
import { mediaUrl } from "../api/client";
import { useSellerStanding } from "./PremiumPromo";
import Tap from "./Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";

// For sellers with an approved store: post this item under the store, or as
// themselves (a personal item). Draws nothing for everyone else.
export default function PostAsPicker({ asStore, onChange, style }: { asStore: boolean; onChange: (asStore: boolean) => void; style?: object }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const me = useSellerStanding();
  const store = me?.store?.status === "APPROVED" ? me.store : null;
  if (!store) return null;
  const options = [
    { value: true, title: store.name, text: "Your store: its page, badge and logo", Icon: Store, logo: store.logoUrl },
    { value: false, title: "Just me", text: "A personal item, under your own name", Icon: User, logo: null },
  ];
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      <Text style={styles.label}>Post as</Text>
      <View style={styles.row}>
        {options.map((o) => {
          const on = asStore === o.value;
          return (
            <Tap key={String(o.value)} style={[styles.option, on && styles.optionOn]} onPress={() => onChange(o.value)} scaleTo={0.97} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              {o.logo ? (
                <Image source={{ uri: mediaUrl(o.logo) }} style={styles.logo} contentFit="cover" />
              ) : (
                <View style={[styles.icon, on && { backgroundColor: colors.primary }]}>
                  <o.Icon size={18} color={on ? "#fff" : colors.primary} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {o.title}
                </Text>
                <Text style={styles.text}>{o.text}</Text>
              </View>
              <View style={[styles.radio, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>{on && <Check size={12} color="#fff" strokeWidth={3.4} />}</View>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: { flexGrow: 1, flexBasis: 220, flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, padding: spacing.sm + 4, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  logo: { width: 38, height: 38, borderRadius: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: colors.text },
  text: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
}));
