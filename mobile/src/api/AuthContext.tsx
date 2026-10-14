import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setAuthToken, setSignedOutHandler, User } from "./client";
import { useTheme } from "../theme/ThemeContext";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  signIn: (user: User, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);
const STORAGE_KEY = "alibe.user";
const TOKEN_KEY = "alibe.token";
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
    AsyncStorage.multiGet([STORAGE_KEY, TOKEN_KEY])
      .then(([[, raw], [, token]]) => {
        // A saved user without a token is from before sessions existed: they
        // sign in again once.
        if (raw && token) {
          setAuthToken(token);
          setUser(JSON.parse(raw));
        }
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
    async (u: User, token: string) => {
      setAuthToken(token);
      setUser(u);
      if (u.themeColor) setAccent(u.themeColor);
      await AsyncStorage.multiSet([
        [STORAGE_KEY, JSON.stringify(u)],
        [TOKEN_KEY, token],
      ]);
    },
    [setAccent]
  );

  // Local half of signing out: forget the session on this device.
  const clearSession = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([STORAGE_KEY, TOKEN_KEY]);
    await clearDrafts();
  }, []);

  const signOut = useCallback(async () => {
    // Tell the server first (revokes the token and this phone's push token);
    // sign out locally even if that fails.
    await api.logout().catch(() => {});
    await clearSession();
  }, [clearSession]);

  // The server says our session is gone (revoked or expired): back to sign-in.
  useEffect(() => {
    setSignedOutHandler(() => clearSession());
    return () => setSignedOutHandler(null);
  }, [clearSession]);

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
    await clearSession();
  }, [user, clearSession]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, updateUser, deleteAccount }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
