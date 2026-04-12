import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Apple,
  Monitor,
  Save,
  ChevronDown,
  RotateCcw,
  Search,
} from "lucide-react";
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

function bindingToParts(binding: KeyBinding, mac: boolean): string[] {
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

  return parts;
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

function KeyPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 text-xs font-mono font-medium bg-notion-bg border border-notion-border rounded-md text-notion-text shadow-[0_1px_0_1px_rgba(0,0,0,0.05)]">
      {label}
    </span>
  );
}

function KeyBadge({
  binding,
  showMac,
}: {
  binding: KeyBinding;
  showMac: boolean;
}) {
  const parts = bindingToParts(binding, showMac);
  return (
    <div className="flex items-center gap-1">
      {parts.map((part, i) => (
        <KeyPill key={i} label={part} />
      ))}
    </div>
  );
}

interface ShortcutRowProps {
  def: ShortcutDefinition;
  showMac: boolean;
  isCapturing: boolean;
  onStartCapture: () => void;
  binding: KeyBinding;
  isModified: boolean;
  onReset: () => void;
  conflictLabel?: string;
}

function ShortcutRow({
  def,
  showMac,
  isCapturing,
  onStartCapture,
  binding,
  isModified,
  onReset,
  conflictLabel,
}: ShortcutRowProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors ${
        isCapturing
          ? "bg-notion-accent/5 ring-1 ring-notion-accent/30"
          : "hover:bg-notion-hover/50"
      }`}
    >
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm text-notion-text truncate">
          {t(def.descriptionKey)}
        </p>
        {conflictLabel && (
          <p className="text-xs text-red-500 mt-0.5">
            {t("settings.shortcuts.conflict", { action: conflictLabel })}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isCapturing ? (
          <span className="inline-flex items-center h-7 px-3 text-xs font-mono bg-notion-accent/10 border border-notion-accent/40 rounded-md text-notion-accent animate-pulse">
            {t("settings.shortcuts.pressKey")}
          </span>
        ) : (
          <KeyBadge binding={binding} showMac={showMac} />
        )}

        {isModified && !isCapturing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="flex items-center gap-1 px-1.5 py-1 text-[10px] text-notion-text-secondary hover:text-notion-accent rounded transition-colors"
            title={t("settings.shortcuts.reset")}
          >
            <RotateCcw size={11} />
          </button>
        )}

        <button
          onClick={onStartCapture}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            isCapturing
              ? "bg-notion-accent/10 text-notion-accent"
              : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
          }`}
        >
          {t("settings.shortcuts.change")}
        </button>
      </div>
    </div>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<ShortcutCategory>
  >(new Set());

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

  const handleResetBinding = useCallback((id: ShortcutId) => {
    setDraftConfig((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const toggleCategory = useCallback((category: ShortcutCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const filteredByCategory = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    const result: Record<ShortcutCategory, ShortcutDefinition[]> = {
      global: [],
      navigation: [],
      view: [],
      terminal: [],
      taskTree: [],
      edit: [],
      calendar: [],
    };

    for (const def of DEFAULT_SHORTCUTS) {
      if (activeCategory) {
        const mapped = activeCategory === "view" ? "view" : activeCategory;
        const defCategory = def.category === "edit" ? "global" : def.category;
        if (defCategory !== mapped) continue;
      }

      if (lowerQuery) {
        const description = t(def.descriptionKey).toLowerCase();
        if (!description.includes(lowerQuery)) continue;
      }

      // Group edit shortcuts under global
      const displayCategory = def.category === "edit" ? "global" : def.category;
      result[displayCategory].push(def);
    }

    return result;
  }, [searchQuery, activeCategory, t]);

  const hasResults = useMemo(
    () => Object.values(filteredByCategory).some((items) => items.length > 0),
    [filteredByCategory],
  );

  return (
    <div className="space-y-4" data-section-id="shortcuts-global">
      {/* Header: platform toggle + search + save */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-notion-bg-secondary rounded-lg p-1 border border-notion-border shrink-0">
          <button
            onClick={() => setShowMac(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              showMac
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            <Apple size={13} />
            {t("tips.showMac")}
          </button>
          <button
            onClick={() => setShowMac(false)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              !showMac
                ? "bg-notion-bg text-notion-text shadow-sm"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            <Monitor size={13} />
            {t("tips.showWin")}
          </button>
        </div>

        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-notion-text-secondary pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("settings.shortcuts.searchPlaceholder")}
            className="w-full h-8 pl-8 pr-3 text-xs bg-notion-bg-secondary border border-notion-border rounded-lg text-notion-text placeholder:text-notion-text-secondary/60 focus:outline-none focus:ring-1 focus:ring-notion-accent/40"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-notion-accent rounded-lg transition-colors hover:bg-notion-accent/90 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          <Save size={13} />
          {t("settings.shortcuts.save")}
        </button>
      </div>

      {/* Shortcut categories */}
      {!hasResults && searchQuery && (
        <p className="text-sm text-notion-text-secondary text-center py-8">
          {t("settings.shortcuts.noResults")}
        </p>
      )}

      {CATEGORY_ORDER.map((category) => {
        const items = filteredByCategory[category];
        if (!items || items.length === 0) return null;

        const isCollapsed = collapsedCategories.has(category);

        return (
          <div key={category}>
            <button
              onClick={() => toggleCategory(category)}
              className="flex items-center gap-2 w-full py-2 text-left group"
            >
              <ChevronDown
                size={14}
                className={`text-notion-text-secondary transition-transform ${
                  isCollapsed ? "-rotate-90" : ""
                }`}
              />
              <h3 className="text-sm font-semibold text-notion-text">
                {t(CATEGORY_LABEL_KEYS[category])}
              </h3>
              <span className="text-[10px] text-notion-text-secondary/60 font-normal">
                {items.length}
              </span>
            </button>

            {!isCollapsed && (
              <div className="space-y-0.5 ml-1">
                {items.map((def) => {
                  const binding = draftConfig[def.id] ?? def.defaultBinding;
                  const isModified =
                    draftConfig[def.id] != null &&
                    !bindingsEqual(draftConfig[def.id]!, def.defaultBinding);

                  return (
                    <ShortcutRow
                      key={def.id}
                      def={def}
                      showMac={showMac}
                      isCapturing={capturingId === def.id}
                      onStartCapture={() => {
                        setCapturingId(def.id);
                        setConflictInfo(null);
                      }}
                      binding={binding}
                      isModified={isModified}
                      onReset={() => handleResetBinding(def.id)}
                      conflictLabel={
                        conflictInfo?.id === def.id
                          ? conflictInfo.label
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
