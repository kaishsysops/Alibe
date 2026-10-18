import React from "react";
import { Image, Modal, Pressable, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import Tap from "./Tap";

function ChatVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  return <VideoView player={player} style={{ width: "100%", height: "80%" }} contentFit="contain" nativeControls />;
}

// Full-screen viewer for a chat photo or video.
export default function MediaViewer({ uri, type, onClose }: { uri: string | null; type: "IMAGE" | "VIDEO"; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(8,8,10,0.96)", justifyContent: "center" }}>
        <Pressable style={{ flex: 1, justifyContent: "center" }} onPress={type === "IMAGE" ? onClose : undefined}>
          {uri && type === "IMAGE" && <Image source={{ uri }} style={{ width: "100%", height: "80%" }} resizeMode="contain" />}
          {uri && type === "VIDEO" && <ChatVideo uri={uri} />}
        </Pressable>
        <Tap
          style={{ position: "absolute", top: insets.top + 12, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}
          onPress={onClose}
          accessibilityLabel="Close"
          scaleTo={0.88}
        >
          <X size={22} color="#fff" />
        </Tap>
      </View>
    </Modal>
  );
}
