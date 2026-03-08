import { useState, useCallback, useRef } from "react";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useShortcutConfig } from "./useShortcutConfig";
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

const MAX_HISTORY = 50;

export interface UseSettingsHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushSnapshot: () => void;
}

export function useSettingsHistory(
  onApply: () => void,
): UseSettingsHistoryReturn {
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const [version, setVersion] = useState(0);
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
    const snap = takeSnapshot();
    pastRef.current = [...pastRef.current.slice(-MAX_HISTORY + 1), snap];
    futureRef.current = [];
    setVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const current = takeSnapshot();
    futureRef.current = [current, ...futureRef.current];
    const prev = pastRef.current.pop()!;
    applySnapshot(prev);
    syncShortcutContext();
    setVersion((v) => v + 1);
    onApply();
  }, [onApply, syncShortcutContext]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const current = takeSnapshot();
    pastRef.current = [...pastRef.current, current];
    const next = futureRef.current.shift()!;
    applySnapshot(next);
    syncShortcutContext();
    setVersion((v) => v + 1);
    onApply();
  }, [onApply, syncShortcutContext]);

  // version is used to trigger re-renders
  void version;

  return {
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    undo,
    redo,
    pushSnapshot,
  };
}
