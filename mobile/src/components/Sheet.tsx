import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LucideIcon } from "lucide-react-native";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useResponsive } from "../hooks/useResponsive";
import Tap from "./Tap";

const useNativeDriver = Platform.OS !== "web";

// Bottom sheet on phones, centred dialog on desktop web. Used for the offer,
// review and report forms and for action menus.
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { isDesktopWeb } = useResponsive();
  const reduceMotion = useReducedMotion();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(reduceMotion ? 1 : 0);
    Animated.spring(slide, { toValue: 1, useNativeDriver, speed: 20, bounciness: 4 }).start();
  }, [visible, slide, reduceMotion]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={[styles.backdrop, isDesktopWeb && styles.backdropCentered]} onPress={onClose} accessibilityLabel="Close">
          <Animated.View
            style={[
              styles.sheet,
              isDesktopWeb ? styles.sheetDesktop : { paddingBottom: Math.max(insets.bottom, spacing.md) },
              { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [isDesktopWeb ? 16 : 300, 0] }) }], opacity: isDesktopWeb ? slide : 1 },
            ]}
          >
            {/* Swallow taps so pressing inside the sheet doesn't close it. */}
            <Pressable onPress={() => {}} style={{ cursor: "auto" } as any}>
              {!isDesktopWeb && <View style={styles.handle} />}
              {!!title && <Text style={styles.title}>{title}</Text>}
              {children}
            </Pressable>
          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type SheetAction = { label: string; icon?: LucideIcon; destructive?: boolean; onPress: () => void };
type ActionSheetOptions = { title?: string; actions: SheetAction[] };
const ActionSheetContext = createContext<((o: ActionSheetOptions) => void) | undefined>(undefined);

export function ActionSheetProvider({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [opts, setOpts] = useState<ActionSheetOptions | null>(null);
  const show = useCallback((o: ActionSheetOptions) => setOpts(o), []);
  const run = (a: SheetAction) => {
    setOpts(null);
    // Let the sheet close before a follow-up sheet or navigation opens.
    setTimeout(a.onPress, 200);
  };
  return (
    <ActionSheetContext.Provider value={show}>
      {children}
      <Sheet visible={!!opts} onClose={() => setOpts(null)} title={opts?.title}>
        <View style={{ paddingHorizontal: spacing.sm }}>
          {opts?.actions.map((a) => (
            <Tap key={a.label} style={styles.action} onPress={() => run(a)} scaleTo={0.98}>
              {a.icon && <a.icon size={20} color={a.destructive ? colors.danger : colors.text} />}
              <Text style={[styles.actionText, a.destructive && { color: colors.danger }]}>{a.label}</Text>
            </Tap>
          ))}
          <Tap style={[styles.action, styles.cancel]} onPress={() => setOpts(null)} scaleTo={0.98}>
            <Text style={[styles.actionText, { textAlign: "center", flex: 1 }]}>Cancel</Text>
          </Tap>
        </View>
      </Sheet>
    </ActionSheetContext.Provider>
  );
}

export function useActionSheet() {
  const ctx = useContext(ActionSheetContext);
  if (!ctx) throw new Error("useActionSheet must be used within ActionSheetProvider");
  return ctx;
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  backdropCentered: { justifyContent: "center", alignItems: "center", padding: spacing.xl },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.sm },
  sheetDesktop: { width: "100%", maxWidth: 440, borderRadius: radius.lg, paddingBottom: spacing.md },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  action: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, minHeight: 54, borderRadius: radius.md },
  actionText: { fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.medium },
  cancel: { marginTop: spacing.xs, backgroundColor: colors.background },
}));
