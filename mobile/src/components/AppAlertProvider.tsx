import React, { createContext, useCallback, useContext, useState } from "react";
import { View, Text, Modal } from "react-native";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react-native";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import Tap from "./Tap";

// Modal dialogs are reserved for decisions (confirm sign-out, delete account).
// Plain notifications and errors go through toasts instead.
type AlertButton = { text: string; onPress?: () => void; style?: "default" | "destructive" | "cancel" };
type AlertKind = "success" | "error" | "warning" | "info";

type AlertOptions = {
  title: string;
  message?: string;
  kind?: AlertKind;
  buttons?: AlertButton[];
};

type AlertContextValue = { show: (opts: AlertOptions) => void };

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<AlertOptions | null>(null);

  const show = useCallback((next: AlertOptions) => {
    setOpts(next);
    setVisible(true);
  }, []);

  const close = (btn?: AlertButton) => {
    setVisible(false);
    setTimeout(() => btn?.onPress?.(), 150);
  };

  const kindMeta = {
    success: { Icon: CheckCircle2, color: colors.success },
    error: { Icon: XCircle, color: colors.danger },
    warning: { Icon: AlertTriangle, color: colors.gold },
    info: { Icon: Info, color: colors.primary },
  };
  const { Icon, color } = kindMeta[opts?.kind ?? "info"];
  const buttons = opts?.buttons?.length ? opts.buttons : [{ text: "OK", style: "default" as const }];

  return (
    <AlertContext.Provider value={{ show }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close()}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={[styles.iconBadge, { backgroundColor: `${color}1A` }]}>
              <Icon size={26} color={color} />
            </View>
            <Text style={styles.title}>{opts?.title}</Text>
            {!!opts?.message && <Text style={styles.message}>{opts.message}</Text>}
            <View style={styles.buttonRow}>
              {buttons.map((btn, i) => (
                <Tap
                  key={i}
                  style={[styles.button, btn.style === "destructive" && styles.buttonDestructive, btn.style === "cancel" && styles.buttonCancel]}
                  onPress={() => close(btn)}
                >
                  <Text style={[styles.buttonText, btn.style === "cancel" && styles.buttonTextCancel]}>{btn.text}</Text>
                </Tap>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAppAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAppAlert must be used within AppAlertProvider");
  return ctx.show;
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    ...cardShadow,
    shadowOpacity: 0.2,
  },
  iconBadge: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, textAlign: "center" },
  message: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs, lineHeight: fontSize.base * 1.4 },
  buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, width: "100%" },
  button: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.sm + 4, alignItems: "center" },
  buttonDestructive: { backgroundColor: colors.danger },
  buttonCancel: { backgroundColor: colors.background },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
  buttonTextCancel: { color: colors.text },
}));
