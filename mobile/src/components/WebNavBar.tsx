import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Search, Heart, MessageCircle, Plus, Bell } from "lucide-react-native";
import { useNotifications } from "../api/NotificationsContext";
import { CountBadge } from "./Badges";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { MAX_CONTENT_WIDTH } from "../hooks/useResponsive";
import { useAuth } from "../api/AuthContext";
import Tap from "./Tap";

const LINKS = [
  { key: "home", label: "Home", route: "HomeTab" },
  { key: "search", label: "Browse", route: "SearchTab" },
  { key: "mylistings", label: "My listings", route: "MyListings" },
  { key: "chats", label: "Chats", route: "ChatsTab" },
];

// Desktop-web top bar: one 64px row with logo, primary links, search and
// account actions (mobile uses the floating tab bar instead).
export default function WebNavBar({ active, onSearch }: { active?: string; onSearch?: (query: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const { data: notifications } = useNotifications();

  const runSearch = () => {
    onSearch?.(query.trim());
    navigation.navigate("Tabs", { screen: "SearchTab", params: { q: query.trim() } });
  };
  const go = (route: string) =>
    ["HomeTab", "SearchTab", "SellTab", "ChatsTab", "ProfileTab"].includes(route)
      ? navigation.navigate("Tabs", { screen: route })
      : navigation.navigate(route);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <Tap onPress={() => go("HomeTab")} scaleTo={0.95} accessibilityLabel="Alibe home">
          <Text style={styles.logo}>Alibe</Text>
        </Tap>

        <View style={styles.links}>
          {LINKS.map((item) => {
            const isActive = active === item.key;
            return (
              <Tap key={item.key} style={[styles.link, isActive && styles.linkActive]} onPress={() => go(item.route)} scaleTo={0.95}>
                <Text style={[styles.linkText, isActive && styles.linkTextActive]}>{item.label}</Text>
                {item.key === "chats" && notifications.unreadChats > 0 && (
                  <View style={styles.linkCount}>
                    <Text style={styles.linkCountText}>{notifications.unreadChats > 99 ? "99+" : notifications.unreadChats}</Text>
                  </View>
                )}
              </Tap>
            );
          })}
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={colors.textMuted} style={{ marginLeft: spacing.md }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Alibe"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            accessibilityLabel="Search listings"
          />
        </View>

        <View style={styles.actions}>
          <Tap style={styles.iconButton} onPress={() => go("Favorites")} accessibilityLabel="Saved items" scaleTo={0.9}>
            <Heart size={18} color={active === "saved" ? colors.primary : colors.text} />
          </Tap>
          <Tap style={styles.iconButton} onPress={() => go("Notifications")} accessibilityLabel={`Notifications${notifications.total ? `, ${notifications.total} new` : ""}`} scaleTo={0.9}>
            <Bell size={18} color={active === "notifications" ? colors.primary : colors.text} />
            <CountBadge count={notifications.total} style={styles.iconBadge} />
          </Tap>
          <Tap style={styles.iconButton} onPress={() => go("ChatsTab")} accessibilityLabel={`Chats${notifications.unreadChats ? `, ${notifications.unreadChats} unread` : ""}`} scaleTo={0.9}>
            <MessageCircle size={18} color={active === "chats" ? colors.primary : colors.text} />
            <CountBadge count={notifications.unreadChats} style={styles.iconBadge} />
          </Tap>
          <Tap style={styles.sellButton} onPress={() => go("SellTab")}>
            <Plus size={16} color="#fff" strokeWidth={2.6} />
            <Text style={styles.sellText}>Sell</Text>
          </Tap>
          <Tap
            style={[styles.avatar, { backgroundColor: user?.avatarColor ?? colors.primary }, active === "profile" && styles.avatarActive]}
            onPress={() => go("ProfileTab")}
            accessibilityLabel="Your profile"
            scaleTo={0.9}
          >
            <Text style={styles.avatarText}>{(user?.name ?? "?").charAt(0).toUpperCase()}</Text>
          </Tap>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrapper: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, zIndex: 10 },
  bar: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    maxWidth: MAX_CONTENT_WIDTH,
    width: "100%",
    alignSelf: "center",
  },
  logo: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.primary, letterSpacing: -0.5 },
  links: { flexDirection: "row", gap: 2 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.sm, borderRadius: radius.pill },
  linkCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  linkCountText: { color: "#fff", fontSize: fontSize.micro, fontWeight: fontWeight.extrabold },
  iconBadge: { position: "absolute", top: -2, right: -2 },
  linkActive: { backgroundColor: colors.primaryTint },
  linkText: { fontSize: fontSize.base, color: colors.textMuted, fontWeight: fontWeight.semibold },
  linkTextActive: { color: colors.primary },
  searchBox: {
    flex: 1,
    maxWidth: 440,
    marginLeft: "auto" as any,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    height: 42,
  },
  searchInput: { flex: 1, height: "100%", paddingHorizontal: spacing.sm, fontSize: fontSize.base, color: colors.text, outlineStyle: "none" as any },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  sellButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  sellText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarActive: { borderWidth: 2, borderColor: colors.primaryLight },
  avatarText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.base },
}));
