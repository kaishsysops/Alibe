import React, { useEffect, useRef } from "react";
import { Animated, Platform, View } from "react-native";
import { NavigationContainer, DefaultTheme, useIsFocused } from "@react-navigation/native";
import { FocusSettle } from "../components/Motion";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Search, Plus, User, MessageCircle } from "lucide-react-native";
import { useAuth } from "../api/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { DEFAULT_ACCENT } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { navigationRef } from "./navigationRef";
import { useNotifications } from "../api/NotificationsContext";

import OnboardingScreen from "../screens/OnboardingScreen";
import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import SellScreen from "../screens/SellScreen";
import MyListingsScreen from "../screens/MyListingsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ChatsScreen from "../screens/ChatsScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import ChatThreadScreen from "../screens/ChatThreadScreen";
import SellerProfileScreen from "../screens/SellerProfileScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import ChangePhoneScreen from "../screens/ChangePhoneScreen";
import EditListingScreen from "../screens/EditListingScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import SavedSearchesScreen from "../screens/SavedSearchesScreen";
import BlockedUsersScreen from "../screens/BlockedUsersScreen";
import VerifyScreen from "../screens/VerifyScreen";
import OrdersScreen from "../screens/OrdersScreen";
import OrderDetailScreen from "../screens/OrderDetailScreen";
import SafetyScreen from "../screens/SafetyScreen";

const Stack = createNativeStackNavigator();

// URL paths for web (and shared links): /listing/abc opens that listing.
const linking = {
  prefixes: [],
  config: {
    screens: {
      Tabs: { screens: { HomeTab: "", SearchTab: "search", SellTab: "sell", ChatsTab: "chats", ProfileTab: "profile" } },
      ProductDetail: "listing/:id",
      SellerProfile: "seller/:id",
      ChatThread: "chat/:id",
      OrderDetail: "order/:id",
      Safety: "safety",
      MyListings: "my-listings",
      Favorites: "saved",
      Notifications: "notifications",
      SavedSearches: "saved-searches",
      EditProfile: "settings",
    },
  },
};
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, typeof Home> = {
  HomeTab: Home,
  SearchTab: Search,
  SellTab: Plus,
  ChatsTab: MessageCircle,
  ProfileTab: User,
};

const FLOATING_BAR_MARGIN = 20;
const FLOATING_BAR_HEIGHT = 56;

// Each tab screen settles in (slight rise + fade) when you switch to it.
function settle<P extends object>(Screen: React.ComponentType<P>) {
  return function Settled(props: P) {
    const focused = useIsFocused();
    return (
      <FocusSettle focused={focused}>
        <Screen {...props} />
      </FocusSettle>
    );
  };
}
const HomeTabScreen = settle(HomeScreen);
const SearchTabScreen = settle(SearchScreen);
const SellTabScreen = settle(SellScreen);
const ChatsTabScreen = settle(ChatsScreen);
const ProfileTabScreen = settle(ProfileScreen);

function TabIcon({ route, focused }: { route: string; focused: boolean }) {
  const { colors } = useTheme();
  const Icon = TAB_ICONS[route];
  const reduceMotion = useReducedMotion();
  // The active bubble springs in; the icon gets a little bounce.
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return v.setValue(focused ? 1 : 0);
    Animated.spring(v, { toValue: focused ? 1 : 0, friction: 6, tension: 140, useNativeDriver: Platform.OS !== "web" }).start();
  }, [focused, reduceMotion]);
  // "Sell" is the primary action, so it's always a filled accent circle.
  if (route === "SellTab") {
    return (
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }}>
        <Icon size={22} color="#fff" strokeWidth={2.6} />
      </View>
    );
  }
  return (
    <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.primaryTint,
          opacity: v,
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
        }}
      />
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) }] }}>
        <Icon size={21} color={focused ? colors.primary : colors.textMuted} strokeWidth={focused ? 2.4 : 2} />
      </Animated.View>
    </View>
  );
}

function Tabs() {
  const { isDesktopWeb } = useResponsive();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: notifications } = useNotifications();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        // Without this the floating bar sits on top of the keyboard and
        // covers whatever field the user is typing into.
        tabBarHideOnKeyboard: true,
        tabBarAccessibilityLabel: route.name.replace("Tab", ""),
        tabBarIcon: ({ focused }) => <TabIcon route={route.name} focused={focused} />,
        tabBarItemStyle: { flex: 1, height: FLOATING_BAR_HEIGHT, alignItems: "center", justifyContent: "center" },
        tabBarStyle: isDesktopWeb
          ? { display: "none" }
          : {
              position: "absolute",
              left: FLOATING_BAR_MARGIN,
              right: FLOATING_BAR_MARGIN,
              bottom: Math.max(insets.bottom - 10, 10),
              height: FLOATING_BAR_HEIGHT,
              borderRadius: FLOATING_BAR_HEIGHT / 2,
              backgroundColor: colors.card,
              borderTopWidth: 0,
              paddingTop: 0,
              paddingBottom: 0,
              elevation: 8,
              shadowColor: "#1A1A1A",
              shadowOpacity: 0.12,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeTabScreen} options={{ title: "Home" }} />
      <Tab.Screen name="SearchTab" component={SearchTabScreen} options={{ title: "Search" }} />
      <Tab.Screen name="SellTab" component={SellTabScreen} options={{ title: "Sell" }} />
      <Tab.Screen
        name="ChatsTab"
        component={ChatsTabScreen}
        options={{
          title: "Chats",
          // Unread message count, so a new message is visible from any tab.
          tabBarBadge: notifications.unreadChats ? (notifications.unreadChats > 99 ? "99+" : notifications.unreadChats) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, color: "#fff", fontSize: 10, fontWeight: "800", top: 6 },
        }}
      />
      <Tab.Screen name="ProfileTab" component={ProfileTabScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();

  // Until sign-in state is known, the animated splash (App.tsx) covers this.
  if (isLoading) return <View style={{ flex: 1, backgroundColor: DEFAULT_ACCENT }} />;

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking as any}
      theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } }}
      documentTitle={{ formatter: () => "Alibe" }}
    >
      {/* Every pushed screen renders its own compact ScreenHeader, so native headers stay off. */}
      {/* Same slide-in on both platforms (Android's default is a plain fade). */}
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right" }}>
        {!user ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
            <Stack.Screen name="MyListings" component={MyListingsScreen} />
            <Stack.Screen name="SellerProfile" component={SellerProfileScreen} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ChangePhone" component={ChangePhoneScreen} />
            <Stack.Screen name="EditListing" component={EditListingScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="SavedSearches" component={SavedSearchesScreen} />
            <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
            <Stack.Screen name="Verify" component={VerifyScreen} />
            <Stack.Screen name="Orders" component={OrdersScreen} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
            <Stack.Screen name="Safety" component={SafetyScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
