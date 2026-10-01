import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, XCircle, Info } from "lucide-react-native";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import Tap from "./Tap";

type ToastKind = "success" | "error" | "info";
type ToastAction = { label: string; onPress: () => void };
type ToastItem = { id: number; kind: ToastKind; message: string; action?: ToastAction };

type ToastApi = {
  show: (kind: ToastKind, message: string, action?: ToastAction) => void;
  success: (message: string, action?: ToastAction) => void;
  error: (message: string, action?: ToastAction) => void;
  info: (message: string, action?: ToastAction) => void;
};

const ToastContext = createContext<ToastApi | undefined>(undefined);
const DURATION_MS = 3200;
const MAX_VISIBLE = 3;
const useNativeDriver = Platform.OS !== "web";

function ToastView({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  const dismiss = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver }).start(() => onDone(item.id));
  }, [anim, item.id, onDone]);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver, speed: 18, bounciness: 6 }).start();
    const t = setTimeout(dismiss, item.action ? DURATION_MS + 1800 : DURATION_MS);
    return () => clearTimeout(t);
  }, [anim, dismiss, item.action]);

  const meta = {
    success: { Icon: CheckCircle2, color: colors.success },
    error: { Icon: XCircle, color: colors.danger },
    info: { Icon: Info, color: colors.primary },
  }[item.kind];

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }, { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
        },
      ]}
    >
      <Tap style={styles.toastBody} onPress={dismiss} scaleTo={0.98} accessibilityRole="alert">
        <meta.Icon size={20} color={meta.color} />
        <Text style={styles.message} numberOfLines={3}>
          {item.message}
        </Text>
        {item.action && (
          <Tap nested
            style={styles.action}
            onPress={() => {
              item.action?.onPress();
              dismiss();
            }}
          >
            <Text style={styles.actionText}>{item.action.label}</Text>
          </Tap>
        )}
      </Tap>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const api = useMemo<ToastApi>(() => {
    const show = (kind: ToastKind, message: string, action?: ToastAction) =>
      setItems((prev) => {
        // Collapse identical back-to-back toasts (e.g. the same network error twice).
        if (prev.some((t) => t.message === message)) return prev;
        return [...prev, { id: nextId.current++, kind, message, action }].slice(-MAX_VISIBLE);
      });
    return {
      show,
      success: (m, a) => show("success", m, a),
      error: (m, a) => show("error", m, a),
      info: (m, a) => show("info", m, a),
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDone={remove} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const useStyles = makeStyles((colors) => ({
  host: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, zIndex: 1000 },
  toast: { width: "100%", maxWidth: 440 },
  toastBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  message: { flex: 1, fontSize: fontSize.base, color: colors.text, fontWeight: fontWeight.medium, lineHeight: fontSize.base * 1.35 },
  action: { paddingHorizontal: spacing.sm + 2, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  actionText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
}));
