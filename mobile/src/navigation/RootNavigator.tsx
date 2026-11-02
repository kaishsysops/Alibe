import React from "react";
import { View } from "react-native";
import { NavigationContainer, DefaultTheme, useIsFocused } from "@react-navigation/native";
import { FocusSettle } from "../components/Motion";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../api/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { DEFAULT_ACCENT } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { navigationRef } from "./navigationRef";
import FloatingTabBar from "../components/FloatingTabBar";
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
import { ChangeEmailScreen, ChangePhoneScreen } from "../screens/ChangeContactScreen";
import AdminReportsScreen from "../screens/AdminReportsScreen";
import AdminIbayScreen from "../screens/AdminIbayScreen";
import IbayBrowseScreen from "../screens/IbayBrowseScreen";
import IbayItemScreen from "../screens/IbayItemScreen";
import PurchasesScreen from "../screens/PurchasesScreen";
import BuyAdScreen from "../screens/BuyAdScreen";
import BoostScreen from "../screens/BoostScreen";
import BuyForYouScreen from "../screens/BuyForYouScreen";
import AdminMoneyScreen from "../screens/AdminMoneyScreen";
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
      IbayBrowse: "ibay",
      IbayItem: "ibay/:id",
      AdminReports: "admin/reports",
      AdminIbay: "admin/ibay",
      AdminMoney: "admin/money",
      Purchases: "purchases",
      BuyAd: "advertise",
      Boost: "boost/:id",
      BuyForYou: "buy-for-you/:id",
    },
  },
};
const Tab = createBottomTabNavigator();


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

function Tabs() {
  const { isDesktopWeb } = useResponsive();
  const { data: notifications } = useNotifications();

  return (
    <Tab.Navigator
      // Desktop web uses the top nav bar instead.
      tabBar={(props) => (isDesktopWeb ? null : <FloatingTabBar {...props} />)}
      screenOptions={{ headerShown: false }}
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
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: "fade" }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ animation: "fade" }} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
            <Stack.Screen name="MyListings" component={MyListingsScreen} />
            <Stack.Screen name="SellerProfile" component={SellerProfileScreen} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ChangePhone" component={ChangePhoneScreen} />
            <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
            <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
            <Stack.Screen name="AdminIbay" component={AdminIbayScreen} />
            <Stack.Screen name="IbayBrowse" component={IbayBrowseScreen} />
            <Stack.Screen name="IbayItem" component={IbayItemScreen} />
            <Stack.Screen name="Purchases" component={PurchasesScreen} />
            <Stack.Screen name="BuyAd" component={BuyAdScreen} />
            <Stack.Screen name="Boost" component={BoostScreen} />
            <Stack.Screen name="BuyForYou" component={BuyForYouScreen} />
            <Stack.Screen name="AdminMoney" component={AdminMoneyScreen} />
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
