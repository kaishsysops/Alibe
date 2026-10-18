import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { ToastProvider } from "./src/components/Toast";
import { AuthProvider } from "./src/api/AuthContext";
import { FavoritesProvider } from "./src/api/FavoritesContext";
import { AppAlertProvider } from "./src/components/AppAlertProvider";
import { NotificationsProvider } from "./src/api/NotificationsContext";
import { ActionSheetProvider } from "./src/components/Sheet";
import RootNavigator from "./src/navigation/RootNavigator";
import AnimatedSplash from "./src/components/AnimatedSplash";
import { useAuth } from "./src/api/AuthContext";

function Splash() {
  const { isLoading } = useAuth();
  return <AnimatedSplash ready={!isLoading} />;
}

function ThemedStatusBar() {
  const { scheme } = useTheme();
  const { user, isLoading } = useAuth();
  // Splash and welcome screens sit on the brand colour: white status bar there.
  const onBrand = isLoading || !user;
  return <StatusBar style={onBrand || scheme === "dark" ? "light" : "dark"} />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationsProvider>
              <FavoritesProvider>
                <AppAlertProvider>
                  <ActionSheetProvider>
                    <ThemedStatusBar />
                    <RootNavigator />
                    <Splash />
                  </ActionSheetProvider>
                </AppAlertProvider>
              </FavoritesProvider>
            </NotificationsProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
