import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Linking } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ShieldOff, LogOut, ExternalLink, RefreshCw } from "lucide-react-native";
import { api, ApiError, StaffMe } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { ConsoleContext } from "../components/ConsoleContext";
import AlibeMark from "../components/AlibeMark";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { SITE, siteUrl } from "../site";
import Shell from "./Shell";
import StaffSignIn from "./StaffSignIn";
import OverviewScreen from "./OverviewScreen";
import ApplicationsScreen from "./ApplicationsScreen";
import PostsScreen from "./PostsScreen";
import { SECTIONS, SectionKey, visibleSections } from "./sections";
import AdminReportsScreen from "../screens/AdminReportsScreen";
import AdminDisputesScreen from "../screens/AdminDisputesScreen";
import AdminSellersScreen from "../screens/AdminSellersScreen";
import AdminMoneyScreen from "../screens/AdminMoneyScreen";
import AdminStaffScreen from "../screens/AdminStaffScreen";
import AdminCategoriesScreen from "../screens/AdminCategoriesScreen";
import AdminIbayScreen from "../screens/AdminIbayScreen";

// admin.alibe.online and portal.alibe.online: the same app bundle, opened on
// a staff address. Sign in, then the sections this person's roles allow.
const Stack = createNativeStackNavigator();

const SCREENS: Record<SectionKey, React.ComponentType<any>> = {
  Overview: OverviewScreen,
  Applications: ApplicationsScreen,
  Posts: PostsScreen,
  Reports: AdminReportsScreen,
  Disputes: AdminDisputesScreen,
  Sellers: AdminSellersScreen,
  Payments: AdminMoneyScreen,
  Staff: AdminStaffScreen,
  Categories: AdminCategoriesScreen,
  Ibay: AdminIbayScreen,
};

// Each section sits inside the shell (sidebar + title).
const wrapped = Object.fromEntries(
  SECTIONS.map((s) => {
    const Screen = SCREENS[s.key];
    const Wrapped = () => (
      <Shell section={s.key}>
        <Screen />
      </Shell>
    );
    return [s.key, Wrapped];
  })
) as unknown as Record<SectionKey, React.ComponentType>;

export default function ConsoleApp() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();
  const [me, setMe] = useState<StaffMe | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");

  const refresh = useCallback(async () => {
    try {
      setMe(await api.staffMe());
      setState("ok");
    } catch (e) {
      setState(e instanceof ApiError && e.status === 403 ? "denied" : "error");
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.title = SITE === "admin" ? "Alibe Admin" : "Alibe Staff Portal";
  }, []);

  useEffect(() => {
    setMe(null);
    setState("loading");
    if (user) refresh();
  }, [user?.id, refresh]);

  // Counts stay fresh while the page is open.
  useEffect(() => {
    if (state !== "ok") return;
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [state, refresh]);

  const sections = useMemo(() => (me ? visibleSections(me, SITE) : []), [me]);
  const linking = useMemo(
    () => ({ prefixes: [], config: { screens: Object.fromEntries(sections.map((s) => [s.key, s.path])) } }),
    [sections]
  );

  if (isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (!user) return <StaffSignIn />;
  if (state === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (state !== "ok" || !me || (SITE === "admin" && !me.admin)) return <NoAccess error={state === "error"} retry={refresh} portalInstead={SITE === "admin" && !!me?.roles.length} />;

  return (
    <ConsoleContext.Provider value={{ inConsole: true, me, refresh }}>
      <NavigationContainer
        linking={linking as any}
        theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } }}
        documentTitle={{ formatter: (_o, route) => `${SECTIONS.find((s) => s.key === route?.name)?.title ?? "Overview"} · Alibe ${SITE === "admin" ? "Admin" : "Portal"}` }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: colors.background } }}>
          {sections.map((s) => (
            <Stack.Screen key={s.key} name={s.key} component={wrapped[s.key]} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </ConsoleContext.Provider>
  );
}

function NoAccess({ error, retry, portalInstead }: { error: boolean; retry: () => void; portalInstead: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const portal = siteUrl("portal");
  const main = siteUrl("main");
  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.icon}>
          <ShieldOff size={30} color={colors.danger} />
        </View>
        <Text style={styles.title}>{error ? "Couldn't check your access" : portalInstead ? "This is the admin site" : "No staff access"}</Text>
        <Text style={styles.text}>
          {error
            ? "Check your connection and try again."
            : portalInstead
              ? "Your roles are on the staff portal. Admin is for admins only."
              : `${user?.email ?? "This account"} isn't Alibe staff. If you should be, ask an admin to add you with a role.`}
        </Text>
        <View style={styles.actions}>
          {error && (
            <Tap style={styles.primary} onPress={retry} scaleTo={0.97}>
              <RefreshCw size={16} color="#fff" />
              <Text style={styles.primaryText}>Try again</Text>
            </Tap>
          )}
          {portalInstead && portal && (
            <Tap style={styles.primary} onPress={() => Linking.openURL(portal)} scaleTo={0.97}>
              <ExternalLink size={16} color="#fff" />
              <Text style={styles.primaryText}>Open the portal</Text>
            </Tap>
          )}
          {!error && !portalInstead && main && (
            <Tap style={styles.primary} onPress={() => Linking.openURL(main)} scaleTo={0.97}>
              <ExternalLink size={16} color="#fff" />
              <Text style={styles.primaryText}>Go to Alibe</Text>
            </Tap>
          )}
          <Tap style={styles.secondary} onPress={signOut} scaleTo={0.97}>
            <LogOut size={16} color={colors.text} />
            <Text style={styles.secondaryText}>Use another account</Text>
          </Tap>
        </View>
        <View style={styles.brand}>
          <AlibeMark size={18} color={colors.textMuted} />
          <Text style={styles.brandText}>Alibe {SITE === "admin" ? "Admin" : "Staff portal"}</Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.background },
  card: { width: "100%", maxWidth: 420, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", gap: spacing.sm, ...cardShadow },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.danger}14`, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text, textAlign: "center" },
  text: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", lineHeight: 21 },
  actions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
  primary: { flexDirection: "row", gap: spacing.sm, height: 48, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
  secondary: { flexDirection: "row", gap: spacing.sm, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.text, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  brand: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg },
  brandText: { fontSize: fontSize.caption, color: colors.textMuted, fontWeight: fontWeight.semibold },
}));
