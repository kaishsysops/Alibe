import { useCallback, useRef, useState } from "react";

// Wraps an async action so it can only run once at a time. A second tap while
// the first is still in flight is ignored — no double purchases, double
// listings or double messages. The lock is a ref (not state) so it holds even
// for two taps landing in the same render frame.
export function useSingleFlight<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  const locked = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (...args: A) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await fnRef.current(...args);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);

  return [run, busy] as const;
}
