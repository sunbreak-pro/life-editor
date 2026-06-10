import { createOptionalContextHook } from "./createOptionalContextHook";
import { ShortcutConfigContext } from "../context/ShortcutConfigContextValue";

/*
 * Optional ShortcutConfig hook (W1). ShortcutConfig is a Mobile 省略 Provider
 * (CLAUDE.md §2) — it is NOT mounted on iOS/Android, so consumers MUST use
 * this OPTIONAL variant (returns null when no Provider) and guard for null
 * (vision/coding-principles.md §4). The web host always mounts the Provider,
 * so its SettingsScreen gets a non-null value.
 */
export const useShortcutConfig = createOptionalContextHook(
  ShortcutConfigContext,
);
