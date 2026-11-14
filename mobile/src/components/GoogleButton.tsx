import React, { useEffect, useRef, useState } from "react";
import { View, LayoutChangeEvent } from "react-native";
import { useTheme } from "../theme/ThemeContext";

// Google's own "Continue with Google" button (Google requires its official
// button). Web only: loads Google Identity Services, which hands back a signed
// ID token for the server to check (backend/src/google.ts).
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

export default function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential: (credential: string) => void }) {
  const { scheme } = useTheme();
  // On the web this is the DOM element Google draws its button into.
  const host = useRef<any>(null);
  const [width, setWidth] = useState(0);
  // Latest callback without re-drawing the button each render.
  const callback = useRef(onCredential);
  callback.current = onCredential;

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
        window.google.accounts.id.renderButton(el, {
          type: "standard",
          theme: scheme === "dark" ? "filled_black" : "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "center",
          width: Math.min(400, Math.round(width)),
        });
      })
      .catch(() => {
        // No button if Google can't be reached; email sign-in still works.
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, width, scheme]);

  return <View ref={host} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ alignSelf: "stretch", minHeight: 44, alignItems: "center" }} />;
}
