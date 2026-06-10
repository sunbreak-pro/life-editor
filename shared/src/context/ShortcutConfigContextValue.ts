import { createContext } from "react";
import type {
  ShortcutId,
  KeyBinding,
  ShortcutConfig,
  ShortcutDefinition,
} from "../types/shortcut";

/*
 * ShortcutConfig context value (W1). Ported from the FROZEN
 * `frontend/src/context/ShortcutConfigContextValue.ts`. This is a Mobile
 * 省略 Provider (CLAUDE.md §2) — consumers read it through the OPTIONAL hook
 * (`useShortcutConfig`) and tolerate a null result when the Provider is not
 * mounted (iOS/Android). The context default is therefore `null`.
 */
export interface ShortcutConfigContextValue {
  /** Effective binding (override ?? default). */
  getBinding: (id: ShortcutId) => KeyBinding;
  setBinding: (id: ShortcutId, binding: KeyBinding) => void;
  resetBinding: (id: ShortcutId) => void;
  resetAll: () => void;
  saveAllBindings: (newConfig: ShortcutConfig) => void;
  /** Does a keyboard event match the binding for `id`? */
  matchEvent: (e: KeyboardEvent, id: ShortcutId) => boolean;
  /** Human-readable accelerator (e.g. "⌘ + K"). */
  getDisplayString: (id: ShortcutId, showMac?: boolean) => string;
  /** First other shortcut whose effective binding equals `binding`, if any. */
  findConflict: (
    binding: KeyBinding,
    excludeId?: ShortcutId,
  ) => ShortcutDefinition | undefined;
  config: ShortcutConfig;
}

export const ShortcutConfigContext =
  createContext<ShortcutConfigContextValue | null>(null);
