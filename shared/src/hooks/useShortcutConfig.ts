import { createOptionalContextHook } from "./createOptionalContextHook";
import { ShortcutConfigContext } from "../context/ShortcutConfigContextValue";

/*
 * Optional ShortcutConfig hook (W1). The web host mounts the Provider in the
 * browser and on Electron (web/src/AppProviders.tsx), but a screen rendered
 * outside that chain — a test, or a host that leaves it out — gets null, so
 * consumers use this OPTIONAL variant and guard for null
 * (vision/coding-principles.md §4) rather than throwing.
 */
export const useShortcutConfig = createOptionalContextHook(
  ShortcutConfigContext,
);
