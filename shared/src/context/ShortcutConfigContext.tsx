import { useCallback, useMemo, type ReactNode } from "react";
import type {
  ShortcutId,
  KeyBinding,
  ShortcutConfig,
  ShortcutDefinition,
} from "../types/shortcut";
import { DEFAULT_SHORTCUTS } from "../constants/defaultShortcuts";
import { isMac } from "../utils/platform";
import {
  bindingToDisplayString,
  matchBinding,
  bindingsEqual,
} from "../utils/shortcutBinding";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  ShortcutConfigContext,
  type ShortcutConfigContextValue,
} from "./ShortcutConfigContextValue";

const SHORTCUT_CONFIG_STORAGE_KEY = "life-editor-shortcut-config";

function getDefinition(id: ShortcutId): ShortcutDefinition | undefined {
  return DEFAULT_SHORTCUTS.find((s) => s.id === id);
}

/*
 * Shared ShortcutConfigProvider (W1). Mobile 省略 Provider (CLAUDE.md §2):
 * the host mounts it only on web/desktop. Overrides persist via
 * useLocalStorage (verbatim logic ported from the FROZEN
 * `frontend/src/context/ShortcutConfigContext.tsx`, minus the editor/term/
 * sidebar IDs that don't exist on web). Rebind / conflict-detect / reset
 * logic lives here; the SettingsShortcuts primitive stays a pure props-only
 * component (CLAUDE.md §6.4).
 */
export function ShortcutConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useLocalStorage<ShortcutConfig>(
    SHORTCUT_CONFIG_STORAGE_KEY,
    {},
  );

  const getBinding = useCallback(
    (id: ShortcutId): KeyBinding => {
      return config[id] ?? getDefinition(id)?.defaultBinding ?? {};
    },
    [config],
  );

  const setBinding = useCallback(
    (id: ShortcutId, binding: KeyBinding) => {
      setConfig((prev) => ({ ...prev, [id]: binding }));
    },
    [setConfig],
  );

  const resetBinding = useCallback(
    (id: ShortcutId) => {
      setConfig((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [setConfig],
  );

  const resetAll = useCallback(() => {
    setConfig({});
  }, [setConfig]);

  const saveAllBindings = useCallback(
    (newConfig: ShortcutConfig) => {
      setConfig(newConfig);
    },
    [setConfig],
  );

  const matchEvent = useCallback(
    (e: KeyboardEvent, id: ShortcutId): boolean => {
      const binding = config[id] ?? getDefinition(id)?.defaultBinding;
      if (!binding) return false;
      return matchBinding(e, binding);
    },
    [config],
  );

  const getDisplayString = useCallback(
    (id: ShortcutId, showMac?: boolean): string => {
      const binding = config[id] ?? getDefinition(id)?.defaultBinding;
      if (!binding) return "";
      return bindingToDisplayString(binding, showMac ?? isMac);
    },
    [config],
  );

  const findConflict = useCallback(
    (
      binding: KeyBinding,
      excludeId?: ShortcutId,
    ): ShortcutDefinition | undefined => {
      for (const def of DEFAULT_SHORTCUTS) {
        if (def.id === excludeId) continue;
        const existing = config[def.id] ?? def.defaultBinding;
        if (bindingsEqual(binding, existing)) {
          return def;
        }
      }
      return undefined;
    },
    [config],
  );

  const value = useMemo(
    (): ShortcutConfigContextValue => ({
      getBinding,
      setBinding,
      resetBinding,
      resetAll,
      saveAllBindings,
      matchEvent,
      getDisplayString,
      findConflict,
      config,
    }),
    [
      getBinding,
      setBinding,
      resetBinding,
      resetAll,
      saveAllBindings,
      matchEvent,
      getDisplayString,
      findConflict,
      config,
    ],
  );

  return (
    <ShortcutConfigContext.Provider value={value}>
      {children}
    </ShortcutConfigContext.Provider>
  );
}
