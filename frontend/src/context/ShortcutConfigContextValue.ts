import { createContext } from "react";
import type {
  ShortcutId,
  KeyBinding,
  ShortcutConfig,
  ShortcutDefinition,
} from "../types/shortcut";

export interface ShortcutConfigContextValue {
  getBinding: (id: ShortcutId) => KeyBinding;
  setBinding: (id: ShortcutId, binding: KeyBinding) => void;
  resetBinding: (id: ShortcutId) => void;
  resetAll: () => void;
  saveAllBindings: (newConfig: ShortcutConfig) => void;
  matchEvent: (e: KeyboardEvent, id: ShortcutId) => boolean;
  getDisplayString: (id: ShortcutId, showMac?: boolean) => string;
  findConflict: (
    binding: KeyBinding,
    excludeId?: ShortcutId,
  ) => ShortcutDefinition | undefined;
  config: ShortcutConfig;
}

export const ShortcutConfigContext =
  createContext<ShortcutConfigContextValue | null>(null);
