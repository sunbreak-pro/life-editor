import { useState, useEffect, useCallback, useRef } from "react";
import { Apple, Monitor, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEFAULT_SHORTCUTS } from "../../constants/defaultShortcuts";
import { useShortcutConfig } from "../../hooks/useShortcutConfig";
import { isMac } from "../../utils/platform";
import type {
  ShortcutId,
  ShortcutCategory,
  ShortcutDefinition,
  KeyBinding,
  ShortcutConfig,
} from "../../types/shortcut";

const CATEGORY_ORDER: ShortcutCategory[] = [
  "global",
  "navigation",
  "view",
  "terminal",
  "taskTree",
  "calendar",
];

const CATEGORY_LABEL_KEYS: Record<ShortcutCategory, string> = {
  global: "tips.shortcutsTab.global",
  navigation: "tips.shortcutsTab.navigation",
  view: "tips.shortcutsTab.view",
  terminal: "tips.shortcutsTab.terminal",
  taskTree: "tips.shortcutsTab.taskTree",
  edit: "tips.shortcutsTab.global",
  calendar: "tips.shortcutsTab.calendar",
};

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

function findDraftConflict(
  draftConfig: ShortcutConfig,
  binding: KeyBinding,
  excludeId?: ShortcutId,
): ShortcutDefinition | undefined {
  for (const def of DEFAULT_SHORTCUTS) {
    if (def.id === excludeId) continue;
    const existing = draftConfig[def.id] ?? def.defaultBinding;
    if (bindingsEqual(binding, existing)) {
      return def;
    }
  }
  return undefined;
}

function getDraftDisplayString(
  draftConfig: ShortcutConfig,
  id: ShortcutId,
  showMac: boolean,
): string {
  const def = DEFAULT_SHORTCUTS.find((s) => s.id === id);
  const binding = draftConfig[id] ?? def?.defaultBinding;
  if (!binding) return "";
  return bindingToDisplayString(binding, showMac);
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
  displayString: string;
  conflictLabel?: string;
}

function ShortcutRow({
  def,
  showMac: _showMac,
  isCapturing,
  onStartCapture,
  displayString,
  conflictLabel,
}: ShortcutRowProps) {
  const { t } = useTranslation();

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
          <Kbd>{displayString}</Kbd>
        )}
        {conflictLabel && (
          <p className="text-xs text-red-500 mt-1">
            {t("settings.shortcuts.conflict", { action: conflictLabel })}
          </p>
        )}
      </td>
      <td className="py-2.5 w-24">
        <button
          onClick={onStartCapture}
          className="px-2 py-1 text-xs text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded transition-colors"
        >
          {t("settings.shortcuts.change")}
        </button>
      </td>
    </tr>
  );
}

interface KeyboardShortcutsProps {
  activeCategory?: ShortcutCategory | null;
  onBeforeChange?: () => void;
}

export function KeyboardShortcuts({
  activeCategory,
  onBeforeChange,
}: KeyboardShortcutsProps) {
  const { t } = useTranslation();
  const { saveAllBindings, config } = useShortcutConfig();
  const [showMac, setShowMac] = useState(isMac);
  const [draftConfig, setDraftConfig] = useState<ShortcutConfig>(() => ({
    ...config,
  }));
  const [capturingId, setCapturingId] = useState<ShortcutId | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{
    id: ShortcutId;
    label: string;
  } | null>(null);
  const capturingRef = useRef(capturingId);
  capturingRef.current = capturingId;
  const draftRef = useRef(draftConfig);
  draftRef.current = draftConfig;

  // Sync draft when config changes externally (e.g. undo/redo)
  useEffect(() => {
    setDraftConfig({ ...config });
  }, [config]);

  const isDirty = JSON.stringify(draftConfig) !== JSON.stringify(config);

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

      const conflict = findDraftConflict(
        draftRef.current,
        binding,
        capturingRef.current,
      );
      if (conflict) {
        setConflictInfo({
          id: capturingRef.current,
          label: t(conflict.descriptionKey),
        });
        return;
      }

      setDraftConfig((prev) => ({ ...prev, [capturingRef.current!]: binding }));
      setCapturingId(null);
      setConflictInfo(null);
    },
    [t],
  );

  useEffect(() => {
    if (!capturingId) return;
    window.addEventListener("keydown", handleCapture, true);
    return () => window.removeEventListener("keydown", handleCapture, true);
  }, [capturingId, handleCapture]);

  const handleSave = useCallback(() => {
    onBeforeChange?.();
    saveAllBindings(draftConfig);
  }, [draftConfig, saveAllBindings, onBeforeChange]);

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
          onClick={handleSave}
          disabled={!isDirty}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Save size={14} />
          {t("settings.shortcuts.save")}
        </button>
      </div>

      {CATEGORY_ORDER.map((category) => {
        if (activeCategory) {
          const mapped = activeCategory === "view" ? "view" : activeCategory;
          if (category !== mapped) return null;
        }
        const items =
          category === "global"
            ? DEFAULT_SHORTCUTS.filter(
                (s) => s.category === "global" || s.category === "edit",
              )
            : DEFAULT_SHORTCUTS.filter((s) => s.category === category);
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
                    displayString={getDraftDisplayString(
                      draftConfig,
                      def.id,
                      showMac,
                    )}
                    conflictLabel={
                      conflictInfo?.id === def.id
                        ? conflictInfo.label
                        : undefined
                    }
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
