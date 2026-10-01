import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildColors, Colors, DEFAULT_ACCENT, Scheme } from "./theme";

export type ThemeMode = "system" | "light" | "dark";

type ThemeState = {
  colors: Colors;
  accent: string;
  setAccent: (hex: string) => void;
  mode: ThemeMode;
  scheme: Scheme;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeState | undefined>(undefined);
const ACCENT_KEY = "alibe.themeColor";
const MODE_KEY = "alibe.themeMode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [accent, setAccentState] = useState<string | null>(null);
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(ACCENT_KEY), AsyncStorage.getItem(MODE_KEY)])
      .then(([savedAccent, savedMode]) => {
        if (savedMode === "light" || savedMode === "dark" || savedMode === "system") setModeState(savedMode);
        setAccentState(savedAccent ?? DEFAULT_ACCENT);
      })
      .catch(() => setAccentState(DEFAULT_ACCENT));
  }, []);

  const setAccent = useCallback((hex: string) => {
    setAccentState(hex);
    AsyncStorage.setItem(ACCENT_KEY, hex).catch(() => {});
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  }, []);

  const scheme: Scheme = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;

  const value = useMemo(
    () => (accent ? { colors: buildColors(accent, scheme), accent, setAccent, mode, scheme, setMode } : null),
    [accent, setAccent, mode, scheme, setMode]
  );

  // Render nothing for the one tick it takes to read the saved colour, so the
  // app never flashes the default accent before switching.
  if (!value) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// Theme-aware StyleSheet: define styles as a function of the palette and get
// back a hook. Sheets are cached per accent + light/dark, so switching is cheap.
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: Colors) => T) {
  const cache = new Map<string, T>();
  return function useStyles(): T {
    const { colors } = useTheme();
    const key = `${colors.primary}-${colors.scheme}`;
    let sheet = cache.get(key);
    if (!sheet) {
      sheet = StyleSheet.create(factory(colors));
      cache.set(key, sheet);
    }
    return sheet;
  };
}
