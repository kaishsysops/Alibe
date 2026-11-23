import React, { useEffect, useRef, useState } from "react";
import { View, Text, LayoutChangeEvent } from "react-native";
import { makeStyles } from "../theme/ThemeContext";
import { radius, fontSize, fontWeight, controlHeight } from "../theme/theme";
import { GoogleIcon } from "./BrandIcons";

// "Continue with Google", drawn in Alibe's style (same size and shape as our
// other buttons), with Google's official button laid invisibly on top so the
// tap really goes to Google Identity Services. That hands back a signed ID
// token for the server to check (backend/src/google.ts). Web only.
declare global {
  interface Window {
    google?: any;
  }
}

const SCRIPT = "https://accounts.google.com/gsi/client";
let loading: Promise<void> | null = null;
function loadScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = SCRIPT;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load Google sign-in"));
    };
    document.head.appendChild(tag);
  });
  return loading;
}

// Google's button is at most 400 x 44; it's stretched to cover ours.
const GSI_HEIGHT = 44;

export default function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential: (credential: string) => void }) {
  const styles = useStyles();
  // On the web this is the DOM element Google draws its button into.
  const host = useRef<any>(null);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState(false);
  // Latest callback without re-drawing the button each render.
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const gsiWidth = Math.min(400, Math.round(width));

  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        const el = host.current as HTMLElement | null;
        if (cancelled || !el || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res: { credential?: string }) => res.credential && callback.current(res.credential),
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        el.innerHTML = "";
        window.google.accounts.id.renderButton(el, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "pill", width: gsiWidth });
        setReady(true);
      })
      .catch(() => {
        // No button if Google can't be reached; email sign-in still works.
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, gsiWidth]);

  const sx = gsiWidth ? width / gsiWidth : 1;
  const sy = controlHeight.primary / GSI_HEIGHT;
  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.button, hover && styles.buttonHover, !ready && { opacity: 0.6 }]} pointerEvents="none">
        <GoogleIcon size={20} />
        <Text style={styles.text}>Continue with Google</Text>
      </View>
      {/* Google's real button: invisible, covering ours, so the click is Google's. */}
      <View
        ref={host}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        accessibilityLabel="Continue with Google"
        style={[styles.overlay, { width: gsiWidth || "100%", height: GSI_HEIGHT, marginTop: -GSI_HEIGHT / 2, marginLeft: -(gsiWidth || 0) / 2, transform: [{ scaleX: sx }, { scaleY: sy }] }]}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { alignSelf: "stretch", height: controlHeight.primary },
  button: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  buttonHover: { borderColor: colors.textMuted, backgroundColor: colors.background },
  text: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  overlay: { position: "absolute", top: "50%", left: "50%", opacity: 0.01, overflow: "hidden" },
}));
