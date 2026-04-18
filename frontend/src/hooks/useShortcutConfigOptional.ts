import { ShortcutConfigContext } from "../context/ShortcutConfigContextValue";
import { createOptionalContextHook } from "./createOptionalContextHook";

export const useShortcutConfigOptional = createOptionalContextHook(
  ShortcutConfigContext,
);
