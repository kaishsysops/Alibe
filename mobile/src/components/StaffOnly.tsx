import React from "react";
import { View } from "react-native";
import { ShieldAlert } from "lucide-react-native";
import { useAuth } from "../api/AuthContext";
import EmptyState from "./EmptyState";
import ScreenHeader from "./ScreenHeader";
import WebNavBar from "./WebNavBar";
import { useResponsive } from "../hooks/useResponsive";
import { useTheme } from "../theme/ThemeContext";

// Wraps every Admin screen. Someone signed in with a non-staff account (say,
// their personal email) gets a clear "staff only" page instead of a screen
// that loads forever because the server refuses it.
export default function StaffOnly({ title, children }: { title: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const { isDesktopWeb } = useResponsive();
  const { colors } = useTheme();
  if (user?.isAdmin) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title={title} />}
      <EmptyState
        icon={ShieldAlert}
        title="Staff only"
        message={`You're signed in as ${user?.email ?? user?.name ?? "someone"}, which isn't a staff account. Sign out and sign in with your staff email, or ask an admin to add this one in Admin > Staff.`}
      />
    </View>
  );
}
