import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Mirrors the OS "Reduce Motion" setting so press springs, skeleton pulses and
// toast slides can fall back to static.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
