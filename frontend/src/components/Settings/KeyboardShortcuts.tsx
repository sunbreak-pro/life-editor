import { useState, useEffect, useCallback, useRef } from "react";
import { Apple, Monitor, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEFAULT_SHORTCUTS } from "../../constants/defaultShortcuts";
import { useShortcutConfig } from "../../hooks/useShortcutConfig";
import { isMac } from "../../utils/platform";
import type {
  ShortcutId,
  ShortcutCategory,
  ShortcutDefinition,
  KeyBinding,
} from "../../types/shortcut";

const CATEGORY_ORDER: ShortcutCategory[] = [
  "global",
  "navigation",
  "view",
  "taskTree",
  "edit",
  "calendar",
];

const CATEGORY_LABEL_KEYS: Record<ShortcutCategory, string> = {
  global: "tips.shortcutsTab.global",
  navigation: "tips.shortcutsTab.navigation",
  view: "tips.shortcutsTab.view",
  taskTree: "tips.shortcutsTab.taskTree",
  edit: "tips.shortcutsTab.taskTree",
  calendar: "tips.shortcutsTab.calendar",
};

function eventToBinding(e: KeyboardEvent): KeyBinding | null {
  if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key))
    return null;

  const binding: KeyBinding = {};
  if (e.metaKey || e.ctrlKey) binding.meta = true;
  if (e.shiftKey) binding.shift = true;
  if (e.altKey) binding.alt = true;

  if (
    binding.meta ||
    binding.alt ||
    e.code.startsWith("Key") ||
    ["Comma", "Period", "Slash", "Backslash"].includes(e.code)
  ) {
    binding.code = e.code;
  } else {
    binding.key = e.key;
  }

  return binding;
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-block px-2 py-1 text-xs font-mono bg-notion-hover border border-notion-border rounded text-notion-text">
      {children}
    </kbd>
  );
}

interface ShortcutRowProps {
  def: ShortcutDefinition;
  showMac: boolean;
  isCapturing: boolean;
  onStartCapture: () => void;
  onReset: () => void;
  conflictLabel?: string;
  isCustomized: boolean;
}

function ShortcutRow({
  def,
  showMac,
  isCapturing,
  onStartCapture,
  onReset,
  conflictLabel,
  isCustomized,
}: ShortcutRowProps) {
  const { t } = useTranslation();
  const { getDisplayString } = useShortcutConfig();

  return (
    <tr className="border-b border-notion-border/50">
      <td className="py-2.5 pr-4 text-sm text-notion-text">
        {t(def.descriptionKey)}
      </td>
      <td className="py-2.5 pr-4 w-48">
        {isCapturing ? (
          <span className="inline-block px-2 py-1 text-xs font-mono bg-notion-accent/10 border border-notion-accent rounded text-notion-accent animate-pulse">
            {t("settings.shortcuts.pressKey")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Kbd>{getDisplayString(def.id, showMac)}</Kbd>
            {isCustomized && (
              <span className="w-1.5 h-1.5 rounded-full bg-notion-accent" />
            )}
          </span>
        )}
        {conflictLabel && (
          <p className="text-xs text-red-500 mt-1">
            {t("settings.shortcuts.conflict", { action: conflictLabel })}
          </p>
        )}
      </td>
      <td className="py-2.5 w-24">
        {!def.readonly && (
          <div className="flex gap-1">
            <button
              onClick={onStartCapture}
              className="px-2 py-1 text-xs text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
            >
              {t("settings.shortcuts.change")}
            </button>
            {isCustomized && (
              <button
                onClick={onReset}
                className="px-2 py-1 text-xs text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
              >
                {t("settings.shortcuts.reset")}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export function KeyboardShortcuts() {
  const { t } = useTranslation();
  const { setBinding, resetBinding, resetAll, findConflict, config } =
    useShortcutConfig();
  const [showMac, setShowMac] = useState(isMac);
  const [capturingId, setCapturingId] = useState<ShortcutId | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{
    id: ShortcutId;
    label: string;
  } | null>(null);
  const capturingRef = useRef(capturingId);
  capturingRef.current = capturingId;

  const handleCapture = useCallback(
    (e: KeyboardEvent) => {
      if (!capturingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setCapturingId(null);
        setConflictInfo(null);
        return;
      }

      const binding = eventToBinding(e);
      if (!binding) return;

      const conflict = findConflict(binding, capturingRef.current);
      if (conflict) {
        setConflictInfo({
          id: capturingRef.current,
          label: t(conflict.descriptionKey),
        });
        return;
      }

      setBinding(capturingRef.current, binding);
      setCapturingId(null);
      setConflictInfo(null);
    },
    [findConflict, setBinding, t],
  );

  useEffect(() => {
    if (!capturingId) return;
    window.addEventListener("keydown", handleCapture, true);
    return () => window.removeEventListener("keydown", handleCapture, true);
  }, [capturingId, handleCapture]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-notion-bg-secondary rounded-lg p-1 w-fit border border-notion-border">
          <button
            onClick={() => setShowMac(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              showMac
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            <Apple size={14} />
            {t("tips.showMac")}
          </button>
          <button
            onClick={() => setShowMac(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              !showMac
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            <Monitor size={14} />
            {t("tips.showWin")}
          </button>
        </div>

        <button
          onClick={resetAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded-md transition-colors"
        >
          <RotateCcw size={14} />
          {t("settings.shortcuts.resetAll")}
        </button>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = DEFAULT_SHORTCUTS.filter((s) => s.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category}>
            <h3 className="text-lg font-semibold text-notion-text mb-3">
              {t(CATEGORY_LABEL_KEYS[category])}
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {items.map((def) => (
                  <ShortcutRow
                    key={def.id}
                    def={def}
                    showMac={showMac}
                    isCapturing={capturingId === def.id}
                    onStartCapture={() => {
                      setCapturingId(def.id);
                      setConflictInfo(null);
                    }}
                    onReset={() => {
                      resetBinding(def.id);
                      setConflictInfo(null);
                    }}
                    conflictLabel={
                      conflictInfo?.id === def.id
                        ? conflictInfo.label
                        : undefined
                    }
                    isCustomized={def.id in config}
                  />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
