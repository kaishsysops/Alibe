import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Search, MapPin, Archive, Camera, User } from "lucide-react-native";
import { colors, spacing, radius } from "../theme/theme";
import { useAuth } from "../api/AuthContext";

const NAV_ITEMS = [
  { key: "home", label: "Home", route: "HomeTab" },
  { key: "search", label: "Browse", route: "SearchTab" },
  { key: "sell", label: "Sell", route: "SellTab" },
  { key: "mylistings", label: "My Listings", route: "MyListingsTab" },
];

export default function WebNavBar({
  active,
  onSearch,
}: {
  active?: string;
  onSearch?: (query: string) => void;
}) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [query, setQuery] = useState("");

  const runSearch = () => {
    onSearch?.(query);
    navigation.navigate("SearchTab");
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.utilityBar}>
        <View style={styles.utilityLeft}>
          <MapPin size={12} color="#fff" />
          <Text style={styles.utilityText}>Deliver to Maldives</Text>
        </View>
        <Text style={styles.utilityText}>{user ? user.name : "Sign in"}</Text>
      </View>

      <View style={styles.mainBar}>
        <TouchableOpacity onPress={() => navigation.navigate("HomeTab")}>
          <Text style={styles.logo}>Alibe</Text>
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products, brands and categories"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
          />
          <TouchableOpacity style={styles.searchButton} onPress={runSearch}>
            <Search size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.iconRow}>
          <TouchableOpacity style={styles.iconItem} onPress={() => navigation.navigate("MyListingsTab")}>
            <Archive size={20} color={colors.text} />
            <Text style={styles.iconLabel}>Listings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconItem} onPress={() => navigation.navigate("SellTab")}>
            <Camera size={20} color={colors.text} />
            <Text style={styles.iconLabel}>Sell</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconItem} onPress={() => navigation.navigate("ProfileTab")}>
            <User size={20} color={colors.text} />
            <Text style={styles.iconLabel}>{user ? "Profile" : "Sign in"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.categoryBar}>
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity key={item.key} onPress={() => navigation.navigate(item.route)}>
            <Text style={[styles.categoryLink, active === item.key && styles.categoryLinkActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  utilityBar: {
    backgroundColor: "#1A1A1A",
    paddingHorizontal: spacing.xl,
    paddingVertical: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  utilityLeft: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  utilityText: { color: "#D8D8D8", fontSize: 12 },
  mainBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.xl,
    maxWidth: 1400,
    width: "100%",
    alignSelf: "center",
  },
  logo: { fontSize: 26, fontWeight: "800", color: colors.primary },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    overflow: "hidden",
    height: 42,
  },
  searchInput: { flex: 1, paddingHorizontal: spacing.md, fontSize: 14, color: colors.text, outlineStyle: "none" as any },
  searchButton: { width: 52, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  iconRow: { flexDirection: "row", gap: spacing.lg },
  iconItem: { alignItems: "center", gap: 2 },
  iconLabel: { fontSize: 11, color: colors.textMuted },
  categoryBar: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxWidth: 1400,
    width: "100%",
    alignSelf: "center",
  },
  categoryLink: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  categoryLinkActive: { color: colors.primary },
});
