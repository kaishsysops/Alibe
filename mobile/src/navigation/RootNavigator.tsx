import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Search, Camera, Archive, User } from "lucide-react-native";
import { useAuth } from "../api/AuthContext";
import { colors } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

import OnboardingScreen from "../screens/OnboardingScreen";
import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import SellScreen from "../screens/SellScreen";
import MyListingsScreen from "../screens/MyListingsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, typeof Home> = {
  HomeTab: Home,
  SearchTab: Search,
  SellTab: Camera,
  MyListingsTab: Archive,
  ProfileTab: User,
};

function TabIcon({ route, focused }: { route: string; focused: boolean }) {
  const Icon = TAB_ICONS[route];
  return <Icon size={22} color={focused ? colors.primary : colors.textMuted} />;
}

function Tabs() {
  const { isDesktopWeb } = useResponsive();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon route={route.name} focused={focused} />,
        tabBarStyle: isDesktopWeb ? { display: "none" } : undefined,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="SearchTab" component={SearchScreen} options={{ title: "Search" }} />
      <Tab.Screen name="SellTab" component={SellScreen} options={{ title: "Sell" }} />
      <Tab.Screen name="MyListingsTab" component={MyListingsScreen} options={{ title: "My Listings" }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen
              name="ProductDetail"
              component={ProductDetailScreen}
              options={{ headerShown: true, title: "" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
