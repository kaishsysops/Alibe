import React, { useState } from "react";
import { View, Text, ScrollView, Linking, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Menu, X, LogOut, ExternalLink, RefreshCw, KeyRound } from "lucide-react-native";
import ChangePassword from "./ChangePassword";
import { useAuth } from "../api/AuthContext";
import { useConsole } from "../components/ConsoleContext";
import AlibeMark from "../components/AlibeMark";
import AvatarPhoto from "../components/AvatarPhoto";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { SITE, siteUrl } from "../site";
import { SECTIONS, SectionKey, accessLabel, visibleSections } from "./sections";

// The admin and portal layout: a sidebar of sections (with live counts of
// what's waiting) beside the content. On narrow screens the sidebar becomes a
// menu behind a button.
const WIDE = 900;
const SIDEBAR = 256;

export default function Shell({ section, children }: { section: SectionKey; children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const wide = width >= WIDE;
  const current = SECTIONS.find((s) => s.key === section)!;
  const { refresh } = useConsole();

  const header = (
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {current.title}
        </Text>
        <Text style={styles.blurb} numberOfLines={1}>
          {current.blurb}
        </Text>
      </View>
      <Tap style={styles.iconButton} onPress={refresh} scaleTo={0.9} accessibilityLabel="Refresh counts">
        <RefreshCw size={16} color={colors.textMuted} />
      </Tap>
    </View>
  );

  if (wide) {
    return (
      <View style={styles.row}>
        <View style={styles.sidebar}>
          <Sidebar section={section} />
        </View>
        <View style={styles.main}>
          {header}
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Brand />
        <Tap style={styles.iconButton} onPress={() => setMenuOpen((o) => !o)} scaleTo={0.9} accessibilityLabel={menuOpen ? "Close menu" : "Open menu"}>
          {menuOpen ? <X size={20} color={colors.text} /> : <Menu size={20} color={colors.text} />}
        </Tap>
      </View>
      {menuOpen ? (
        <View style={styles.drawer}>
          <Sidebar section={section} onNavigate={() => setMenuOpen(false)} hideBrand />
        </View>
      ) : (
        <>
          {header}
          <View style={{ flex: 1 }}>{children}</View>
        </>
      )}
    </View>
  );
}

function Brand() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.brand}>
      <AlibeMark size={26} color={colors.primary} />
      <Text style={styles.brandText}>Alibe</Text>
      <View style={[styles.sitePill, SITE === "admin" && { backgroundColor: colors.text }]}>
        <Text style={[styles.sitePillText, SITE === "admin" && { color: colors.background }]}>{SITE === "admin" ? "Admin" : "Portal"}</Text>
      </View>
    </View>
  );
}

function Sidebar({ section, onNavigate, hideBrand }: { section: SectionKey; onNavigate?: () => void; hideBrand?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const { me } = useConsole();
  const [changing, setChanging] = useState(false);
  if (!me) return null;
  const items = visibleSections(me, SITE);
  const other = SITE === "admin" ? siteUrl("portal") : me.admin ? siteUrl("admin") : null;

  return (
    <View style={{ flex: 1 }}>
      {!hideBrand && (
        <View style={{ padding: spacing.md, paddingBottom: spacing.sm }}>
          <Brand />
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.sm, gap: 2 }} showsVerticalScrollIndicator={false}>
        {items.map((s) => {
          const active = s.key === section;
          const count = s.count ? me.counts[s.count] : null;
          return (
            <Tap
              key={s.key}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => {
                onNavigate?.();
                navigation.navigate(s.key);
              }}
              scaleTo={0.98}
              accessibilityLabel={`${s.title}${count ? `, ${count} waiting` : ""}`}
            >
              <s.Icon size={18} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.navText, active && styles.navTextActive]} numberOfLines={1}>
                {s.title}
              </Text>
              {!!count && (
                <View style={styles.count}>
                  <Text style={styles.countText}>{count > 99 ? "99+" : count}</Text>
                </View>
              )}
            </Tap>
          );
        })}
      </ScrollView>
      <View style={styles.account}>
        <View style={styles.accountRow}>
          <View style={[styles.avatar, { backgroundColor: user?.avatarColor ?? colors.primary }]}>
            <Text style={styles.avatarText}>{(user?.name ?? "?").charAt(0).toUpperCase()}</Text>
            <AvatarPhoto uri={user?.avatarUrl} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.accountName} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={styles.accountRole} numberOfLines={1}>
              {user?.username ? `@${user.username} · ` : ""}
              {accessLabel(me)}
            </Text>
          </View>
        </View>
        <ChangePassword visible={changing} onClose={() => setChanging(false)} />
        <View style={styles.accountLinks}>
          {siteUrl("main") && (
            <Tap style={styles.smallLink} onPress={() => Linking.openURL(siteUrl("main")!)} scaleTo={0.96}>
              <ExternalLink size={13} color={colors.textMuted} />
              <Text style={styles.smallLinkText}>Marketplace</Text>
            </Tap>
          )}
          {other && (
            <Tap style={styles.smallLink} onPress={() => Linking.openURL(other)} scaleTo={0.96}>
              <ExternalLink size={13} color={colors.textMuted} />
              <Text style={styles.smallLinkText}>{SITE === "admin" ? "Portal" : "Admin site"}</Text>
            </Tap>
          )}
          <Tap style={styles.smallLink} onPress={() => setChanging(true)} scaleTo={0.96}>
            <KeyRound size={13} color={colors.textMuted} />
            <Text style={styles.smallLinkText}>Password</Text>
          </Tap>
          <Tap style={styles.smallLink} onPress={signOut} scaleTo={0.96} accessibilityLabel="Sign out">
            <LogOut size={13} color={colors.textMuted} />
            <Text style={styles.smallLinkText}>Sign out</Text>
          </Tap>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flex: 1, flexDirection: "row", backgroundColor: colors.background },
  sidebar: { width: SIDEBAR, backgroundColor: colors.card, borderRightWidth: 1, borderRightColor: colors.border },
  main: { flex: 1, minWidth: 0 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, letterSpacing: -0.3 },
  blurb: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  drawer: { flex: 1, backgroundColor: colors.card },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandText: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  sitePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  sitePillText: { fontSize: fontSize.micro, fontWeight: fontWeight.extrabold, color: colors.primary, letterSpacing: 0.4, textTransform: "uppercase" },
  navItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, height: 42, paddingHorizontal: spacing.sm + 4, borderRadius: radius.md },
  navItemActive: { backgroundColor: colors.primaryTint },
  navText: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  navTextActive: { color: colors.primary, fontWeight: fontWeight.bold },
  count: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: fontSize.micro, fontWeight: fontWeight.extrabold, color: "#fff" },
  account: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.sm },
  accountRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { color: "#fff", fontWeight: fontWeight.extrabold },
  accountName: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  accountRole: { fontSize: fontSize.caption, color: colors.textMuted },
  accountLinks: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  smallLink: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  smallLinkText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textMuted },
}));
