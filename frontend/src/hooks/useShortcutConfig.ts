import { ShortcutConfigContext } from "../context/ShortcutConfigContextValue";
import { createContextHook } from "./createContextHook";

export const useShortcutConfig = createContextHook(
  ShortcutConfigContext,
  "useShortcutConfig",
);
