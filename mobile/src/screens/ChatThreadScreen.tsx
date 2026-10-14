import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MoreHorizontal } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Conversation } from "../api/client";
import { useAuth } from "../api/AuthContext";
import ScreenHeader from "../components/ScreenHeader";
import Tap from "../components/Tap";
import { useTrustActions } from "../components/TrustSheets";
import { useActionSheet } from "../components/Sheet";
import ChatThreadView, { useOtherParty } from "../components/ChatThreadView";
import { makeStyles, useTheme } from "../theme/ThemeContext";

export default function ChatThreadScreen() {
  const styles = useStyles();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const other = useOtherParty(conversation, user?.id);
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const trust = useTrustActions();
  const showSheet = useActionSheet();

  // Report or block the other person, right from the chat.
  const menu = other ? (
    <Tap
      style={styles.menuButton}
      onPress={() =>
        showSheet({
          title: other.name,
          actions: [
            { label: `Report ${other.name}`, icon: trust.reportIcon, onPress: () => trust.report({ reportedUserId: other.id }) },
            { label: `Block ${other.name}`, icon: trust.blockIcon, destructive: true, onPress: () => trust.block(other, () => navigation.goBack()) },
          ],
        })
      }
      hitSlop={8}
      scaleTo={0.88}
      accessibilityLabel="More options"
    >
      <MoreHorizontal size={22} color={colors.text} />
    </Tap>
  ) : null;

  return (
    <View style={styles.container}>
      <ScreenHeader title={other?.name ?? "Chat"} subtitle={other?.username ? `@${other.username}` : undefined} right={menu} />
      {/* The whole thread (list + composer) lifts with the keyboard, so the
          input and the latest messages always stay visible. */}
      <KeyboardAvoidingView style={{ flex: 1, paddingBottom: insets.bottom }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ChatThreadView conversationId={route.params.id} onLoaded={setConversation} />
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  menuButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
}));
