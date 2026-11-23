import { createContext, useContext } from "react";
import type { StaffMe } from "../api/client";

// Set inside the admin and portal sites. Screens shared with the marketplace
// (the old in-app admin screens) use it to drop their own headers, since the
// console draws the layout, and to hide actions the person can't take.
export type ConsoleState = { inConsole: true; me: StaffMe; refresh: () => void } | { inConsole: false; me: null; refresh: () => void };

export const ConsoleContext = createContext<ConsoleState>({ inConsole: false, me: null, refresh: () => {} });
export const useConsole = () => useContext(ConsoleContext);
