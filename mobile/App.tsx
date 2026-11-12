import React, { useState } from "react";
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
import MaintenanceOverlay from "./src/components/MaintenanceOverlay";
import { useAuth } from "./src/api/AuthContext";
import { EntranceGate } from "./src/components/Motion";

function Screens() {
  const { isLoading } = useAuth();
  const [splashLifting, setSplashLifting] = useState(false);
  return (
    <EntranceGate.Provider value={splashLifting}>
      <RootNavigator />
      <AnimatedSplash ready={!isLoading} onExit={() => setSplashLifting(true)} />
      <MaintenanceOverlay />
    </EntranceGate.Provider>
  );
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
                    <Screens />
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
