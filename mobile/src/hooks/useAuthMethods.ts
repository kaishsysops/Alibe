import { useEffect, useState } from "react";
import { api } from "../api/client";

// Which sign-in methods the server has switched on (email only for now). Asked
// once per app start and shared. Until the answer arrives, phone counts as off
// so nothing phone-only flashes up.
type Methods = { email: boolean; phone: boolean };
let cache: Methods | null = null;
let pending: Promise<Methods> | null = null;

export function useAuthMethods(): Methods {
  const [methods, setMethods] = useState<Methods>(cache ?? { email: true, phone: false });
  useEffect(() => {
    if (cache) return;
    pending ??= api.authMethods().then((m) => (cache = m));
    pending.then(setMethods).catch(() => {});
  }, []);
  return methods;
}
