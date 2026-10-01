import React from "react";
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

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

export default function App() {
  return (
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
                  </ActionSheetProvider>
                </AppAlertProvider>
              </FavoritesProvider>
            </NotificationsProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
