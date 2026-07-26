import { createOptionalContextHook } from "./createOptionalContextHook";
import { ShortcutConfigContext } from "../context/ShortcutConfigContextValue";

/*
 * Optional ShortcutConfig hook (W1). ShortcutConfig is a Mobile 省略 Provider
 * (CLAUDE.md §2) — the web host skips it on the native Capacitor shells
 * (#320, ShortcutConfigHost in web/src/MainScreen.tsx), so consumers MUST use
 * this OPTIONAL variant (returns null when no Provider) and guard for null
 * (vision/coding-principles.md §4). On browser / Electron the Provider is
 * mounted and SettingsScreen gets a non-null value.
 */
export const useShortcutConfig = createOptionalContextHook(
  ShortcutConfigContext,
);
