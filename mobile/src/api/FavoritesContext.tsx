import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./client";
import { useAuth } from "./AuthContext";
import { useToast } from "../components/Toast";

type FavoritesState = {
  favoriteIds: Set<string>;
  isFavorite: (listingId: string) => boolean;
  toggleFavorite: (listingId: string) => void;
  refresh: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesState | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  // What the server is known to have, and listings with a sync in flight.
  // Rapid taps only flip local state; one sync loop per listing reconciles
  // with the server, so the UI can never end up out of step with it.
  const serverIds = useRef<Set<string>>(new Set());
  const localIds = useRef<Set<string>>(new Set());
  const syncing = useRef<Set<string>>(new Set());

  const commit = (next: Set<string>) => {
    localIds.current = next;
    setFavoriteIds(next);
  };

  const refresh = useCallback(async () => {
    if (!user) {
      serverIds.current = new Set();
      commit(new Set());
      return;
    }
    try {
      const listings = await api.favorites(user.id);
      serverIds.current = new Set(listings.map((l) => l.id));
      commit(new Set(serverIds.current));
    } catch {
      // keep whatever we had; the next refresh will catch up
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sync = useCallback(
    async (listingId: string) => {
      if (!user || syncing.current.has(listingId)) return;
      syncing.current.add(listingId);
      try {
        while (localIds.current.has(listingId) !== serverIds.current.has(listingId)) {
          const want = localIds.current.has(listingId);
          if (want) await api.addFavorite(user.id, listingId);
          else await api.removeFavorite(user.id, listingId);
          if (want) serverIds.current.add(listingId);
          else serverIds.current.delete(listingId);
        }
      } catch (e) {
        // Roll back to what the server actually has.
        const next = new Set(localIds.current);
        if (serverIds.current.has(listingId)) next.add(listingId);
        else next.delete(listingId);
        commit(next);
        toast.error(errorMessage(e, "Couldn't update your saved items."));
      } finally {
        syncing.current.delete(listingId);
      }
    },
    [user, toast]
  );

  const toggleFavorite = useCallback(
    (listingId: string) => {
      if (!user) return;
      const next = new Set(localIds.current);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      commit(next);
      sync(listingId);
    },
    [user, sync]
  );

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite: (id) => favoriteIds.has(id), toggleFavorite, refresh }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
