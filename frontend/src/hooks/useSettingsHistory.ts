import { useCallback } from "react";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useShortcutConfig } from "./useShortcutConfig";
import { useUndoRedo } from "../components/shared/UndoRedo";
import type { ShortcutConfig } from "../types/shortcut";

const SETTINGS_STORAGE_KEYS = [
  STORAGE_KEYS.THEME,
  STORAGE_KEYS.FONT_SIZE,
  STORAGE_KEYS.NOTIFICATIONS_ENABLED,
  STORAGE_KEYS.LANGUAGE,
  STORAGE_KEYS.SHORTCUT_CONFIG,
  STORAGE_KEYS.EFFECT_VOLUME,
] as const;

type Snapshot = Record<string, string | null>;

function takeSnapshot(): Snapshot {
  const snap: Snapshot = {};
  for (const key of SETTINGS_STORAGE_KEYS) {
    snap[key] = localStorage.getItem(key);
  }
  return snap;
}

function applySnapshot(snap: Snapshot) {
  for (const [key, value] of Object.entries(snap)) {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  }
}

export interface UseSettingsHistoryReturn {
  pushSnapshot: () => void;
}

export function useSettingsHistory(
  onApply: () => void,
): UseSettingsHistoryReturn {
  const { push } = useUndoRedo();
  const { saveAllBindings } = useShortcutConfig();

  const syncShortcutContext = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SHORTCUT_CONFIG);
      const config: ShortcutConfig = raw ? JSON.parse(raw) : {};
      saveAllBindings(config);
    } catch {
      saveAllBindings({});
    }
  }, [saveAllBindings]);

  const pushSnapshot = useCallback(() => {
    const before = takeSnapshot();
    queueMicrotask(() => {
      const after = takeSnapshot();
      push("settings", {
        label: "settings",
        undo: () => {
          applySnapshot(before);
          syncShortcutContext();
          onApply();
        },
        redo: () => {
          applySnapshot(after);
          syncShortcutContext();
          onApply();
        },
      });
    });
  }, [push, onApply, syncShortcutContext]);

  return { pushSnapshot };
}
