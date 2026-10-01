import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// useState that survives unmounts, navigation and app restarts. Used for
// in-progress forms so going back never throws away what the user typed.
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;
        setValue(raw ? { ...initialRef.current, ...JSON.parse(raw) } : initialRef.current);
      })
      .catch(() => {})
      .finally(() => !cancelled && setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [key, value, hydrated]);

  const clear = useCallback(() => {
    setValue(initialRef.current);
    AsyncStorage.removeItem(key).catch(() => {});
  }, [key]);

  return [value, setValue, { hydrated, clear }] as const;
}
