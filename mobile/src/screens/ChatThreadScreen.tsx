import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Conversation } from "../api/client";
import { useAuth } from "../api/AuthContext";
import ScreenHeader from "../components/ScreenHeader";
import ChatThreadView, { useOtherParty } from "../components/ChatThreadView";
import { makeStyles } from "../theme/ThemeContext";

export default function ChatThreadScreen() {
  const styles = useStyles();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const other = useOtherParty(conversation, user?.id);

  return (
    <View style={styles.container}>
      <ScreenHeader title={other?.name ?? "Chat"} subtitle={other?.username ? `@${other.username}` : undefined} />
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
}));
