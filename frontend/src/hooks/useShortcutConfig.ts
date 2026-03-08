import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import { createElement } from "react";
import type {
  ShortcutId,
  KeyBinding,
  ShortcutConfig,
  ShortcutDefinition,
} from "../types/shortcut";
import { DEFAULT_SHORTCUTS } from "../constants/defaultShortcuts";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { isMac } from "../utils/platform";

interface ShortcutConfigContextValue {
  getBinding: (id: ShortcutId) => KeyBinding;
  setBinding: (id: ShortcutId, binding: KeyBinding) => void;
  resetBinding: (id: ShortcutId) => void;
  resetAll: () => void;
  matchEvent: (e: KeyboardEvent, id: ShortcutId) => boolean;
  getDisplayString: (id: ShortcutId, showMac?: boolean) => string;
  findConflict: (
    binding: KeyBinding,
    excludeId?: ShortcutId,
  ) => ShortcutDefinition | undefined;
  config: ShortcutConfig;
}

const ShortcutConfigContext = createContext<ShortcutConfigContextValue | null>(
  null,
);

function loadConfig(): ShortcutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SHORTCUT_CONFIG);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveConfig(config: ShortcutConfig) {
  localStorage.setItem(STORAGE_KEYS.SHORTCUT_CONFIG, JSON.stringify(config));
}

function getDefinition(id: ShortcutId): ShortcutDefinition | undefined {
  return DEFAULT_SHORTCUTS.find((s) => s.id === id);
}

function bindingToDisplayString(binding: KeyBinding, mac: boolean): string {
  const parts: string[] = [];
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.meta) parts.push(mac ? "⌘" : "Ctrl");
  if (binding.shift) parts.push(mac ? "⇧" : "Shift");
  if (binding.alt) parts.push(mac ? "⌥" : "Alt");

  if (binding.code) {
    const codeMap: Record<string, string> = {
      KeyD: "D",
      KeyJ: "J",
      KeyK: "K",
      KeyT: "T",
      KeyW: "W",
      KeyZ: "Z",
      Comma: ",",
      Period: ".",
      Enter: "Enter",
      Backquote: "`",
    };
    parts.push(codeMap[binding.code] ?? binding.code.replace(/^Key/, ""));
  } else if (binding.key) {
    const keyMap: Record<string, string> = {
      " ": "Space",
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      Tab: "Tab",
      Enter: "Enter",
    };
    parts.push(keyMap[binding.key] ?? binding.key.toUpperCase());
  }

  return parts.join(" + ");
}

function matchBinding(e: KeyboardEvent, binding: KeyBinding): boolean {
  if (binding.ctrl) {
    if (!e.ctrlKey) return false;
  } else {
    const mod = e.metaKey || e.ctrlKey;
    if (binding.meta && !mod) return false;
    if (!binding.meta && mod) return false;
  }
  if (binding.shift && !e.shiftKey) return false;
  if (!binding.shift && e.shiftKey) return false;
  if (binding.alt && !e.altKey) return false;
  if (!binding.alt && e.altKey) return false;

  if (binding.code) {
    return e.code === binding.code;
  }
  if (binding.key) {
    return e.key === binding.key;
  }
  return false;
}

function bindingsEqual(a: KeyBinding, b: KeyBinding): boolean {
  return (
    (a.key ?? "") === (b.key ?? "") &&
    (a.code ?? "") === (b.code ?? "") &&
    !!a.meta === !!b.meta &&
    !!a.ctrl === !!b.ctrl &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt
  );
}

export function ShortcutConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ShortcutConfig>(loadConfig);

  const getBinding = useCallback(
    (id: ShortcutId): KeyBinding => {
      return config[id] ?? getDefinition(id)?.defaultBinding ?? {};
    },
    [config],
  );

  const setBinding = useCallback((id: ShortcutId, binding: KeyBinding) => {
    setConfig((prev) => {
      const next = { ...prev, [id]: binding };
      saveConfig(next);
      return next;
    });
  }, []);

  const resetBinding = useCallback((id: ShortcutId) => {
    setConfig((prev) => {
      const next = { ...prev };
      delete next[id];
      saveConfig(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setConfig({});
    saveConfig({});
  }, []);

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
      matchEvent,
      getDisplayString,
      findConflict,
      config,
    ],
  );

  return createElement(ShortcutConfigContext.Provider, { value }, children);
}

export function useShortcutConfig(): ShortcutConfigContextValue {
  const ctx = useContext(ShortcutConfigContext);
  if (!ctx)
    throw new Error(
      "useShortcutConfig must be used within ShortcutConfigProvider",
    );
  return ctx;
}
