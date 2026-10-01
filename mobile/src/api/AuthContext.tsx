import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, User } from "./client";
import { useTheme } from "../theme/ThemeContext";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  signIn: (user: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);
const STORAGE_KEY = "alibe.user";
// Per-user drafts (sell form, chat composers) live under this prefix and are
// wiped on sign-out so the next person on the device starts clean.
export const DRAFT_PREFIX = "alibe.draft.";

async function clearDrafts() {
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  const drafts = keys.filter((k) => k.startsWith(DRAFT_PREFIX));
  if (drafts.length) await AsyncStorage.multiRemove(drafts).catch(() => {});
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAccent } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setUser(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Refresh the cached profile in the background so contact settings, phone
  // and theme changed on another device show up here too.
  useEffect(() => {
    if (!user?.id) return;
    api
      .myProfile(user.id)
      .then((fresh) => {
        setUser((prev) => {
          if (!prev) return prev;
          const next = { ...prev, ...fresh };
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
        if (fresh.themeColor) setAccent(fresh.themeColor);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signIn = useCallback(
    async (u: User) => {
      setUser(u);
      if (u.themeColor) setAccent(u.themeColor);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    },
    [setAccent]
  );

  const signOut = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
    await clearDrafts();
  }, []);

  const updateUser = useCallback(async (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    await api.deleteAccount(user.id);
    await signOut();
  }, [user, signOut]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, updateUser, deleteAccount }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
