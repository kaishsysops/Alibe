import React, { useEffect, useState } from "react";
import { Image, Modal, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { mediaUrl } from "../api/client";
import Tap from "./Tap";
import { spacing, fontSize, fontWeight } from "../theme/theme";

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const SPRING = { damping: 20, stiffness: 220 };

// Full-screen photos: pinch or double-tap to zoom, drag to look around, swipe
// sideways for the next photo, swipe down to close. With a mouse: double-click
// to zoom, drag to look around, and the arrows.
export default function PhotoViewer({ images, start, onClose }: { images: string[]; start: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const resetZoom = () => {
    scale.value = savedScale.value = 1;
    x.value = y.value = savedX.value = savedY.value = 0;
  };

  useEffect(() => {
    if (start !== null) {
      setIndex(start);
      resetZoom();
    }
  }, [start]);

  const step = (d: number) => {
    resetZoom();
    setIndex((i) => (i + d + images.length) % images.length);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(0.8, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        scale.value = withSpring(1, SPRING);
        x.value = withSpring(0, SPRING);
        y.value = withSpring(0, SPRING);
        savedScale.value = 1;
        savedX.value = savedY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        // Zoomed in: stay wherever they dragged to, but keep the photo on screen.
        const maxX = (width * (savedScale.value - 1)) / 2;
        const maxY = (height * (savedScale.value - 1)) / 2;
        savedX.value = Math.min(maxX, Math.max(-maxX, x.value));
        savedY.value = Math.min(maxY, Math.max(-maxY, y.value));
        x.value = withSpring(savedX.value, SPRING);
        y.value = withSpring(savedY.value, SPRING);
        return;
      }
      const sideways = Math.abs(e.translationX) > Math.abs(e.translationY);
      if (!sideways && e.translationY > 110) {
        runOnJS(onClose)();
      } else if (sideways && Math.abs(e.translationX) > width * 0.22 && images.length > 1) {
        const direction = e.translationX < 0 ? 1 : -1;
        // Let the old photo finish leaving before the next one appears.
        x.value = withTiming(-direction * width, { duration: 160 }, () => {
          runOnJS(step)(direction);
        });
        return;
      }
      x.value = withSpring(0, SPRING);
      y.value = withSpring(0, SPRING);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = savedScale.value > 1 ? 1 : DOUBLE_TAP_ZOOM;
      scale.value = withSpring(next, SPRING);
      x.value = withSpring(0, SPRING);
      y.value = withSpring(0, SPRING);
      savedScale.value = next;
      savedX.value = savedY.value = 0;
    });

  const photoStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  // The backdrop lightens as a swipe down carries the photo away.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: savedScale.value > 1 ? 1 : Math.max(0.4, 1 - Math.abs(y.value) / (height * 0.7)) }));

  return (
    <Modal visible={start !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
          <Animated.View style={[{ flex: 1 }, photoStyle, Platform.OS === "web" && ({ cursor: "grab" } as any)]}>
            <Image source={{ uri: mediaUrl(images[index]) }} style={{ flex: 1 }} resizeMode="contain" accessibilityLabel={`Photo ${index + 1} of ${images.length}`} />
          </Animated.View>
        </GestureDetector>

        <Tap style={[styles.button, { position: "absolute", right: spacing.md, top: insets.top + spacing.sm }]} onPress={onClose} scaleTo={0.88} accessibilityLabel="Close photo">
          <X size={22} color="#fff" />
        </Tap>
        {images.length > 1 && (
          <>
            {Platform.OS === "web" && (
              <>
                <Tap style={[styles.button, styles.arrow, { left: spacing.md }]} onPress={() => step(-1)} scaleTo={0.88} accessibilityLabel="Previous photo">
                  <ChevronLeft size={24} color="#fff" />
                </Tap>
                <Tap style={[styles.button, styles.arrow, { right: spacing.md }]} onPress={() => step(1)} scaleTo={0.88} accessibilityLabel="Next photo">
                  <ChevronRight size={24} color="#fff" />
                </Tap>
              </>
            )}
            <View pointerEvents="none" style={[styles.counter, { bottom: insets.bottom + spacing.lg }]}>
              <Text style={styles.counterText}>
                {index + 1} of {images.length}
              </Text>
            </View>
          </>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "#000" },
  button: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  arrow: { position: "absolute", top: "50%", marginTop: -22 },
  counter: { position: "absolute", alignSelf: "center", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)" },
  counterText: { color: "#fff", fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
