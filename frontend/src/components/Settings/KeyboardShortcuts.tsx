import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Apple,
  Monitor,
  Save,
  ChevronDown,
  RotateCcw,
  Search,
  Globe,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEFAULT_SHORTCUTS } from "../../constants/defaultShortcuts";
import { useShortcutConfig } from "../../hooks/useShortcutConfig";
import { getDataService } from "../../services/dataServiceFactory";
import { isTauri } from "../../services/bridge";
import { isMac } from "../../utils/platform";
import {
  keyBindingToAccelerator,
  acceleratorToKeyBinding,
} from "../../utils/accelerator";
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

interface ShortcutRowBaseProps {
  descriptionKey: string;
  showMac: boolean;
  isCapturing: boolean;
  onStartCapture: () => void;
  onCancelCapture: () => void;
  binding: KeyBinding;
  isModified: boolean;
  onReset: () => void;
  conflictLabel?: string;
}

function ShortcutRowBase({
  descriptionKey,
  showMac,
  isCapturing,
  onStartCapture,
  onCancelCapture,
  binding,
  isModified,
  onReset,
  conflictLabel,
}: ShortcutRowBaseProps) {
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
        <p className="text-sm text-notion-text truncate">{t(descriptionKey)}</p>
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

        {isCapturing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancelCapture();
            }}
            className="px-2.5 py-1 text-xs rounded-md text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors"
          >
            {t("settings.shortcuts.cancel")}
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

// --- Global Shortcut definitions ---

interface GlobalShortcutDef {
  id: string;
  descriptionKey: string;
  defaultAccelerator: string;
}

const GLOBAL_SHORTCUT_DEFS: GlobalShortcutDef[] = [
  {
    id: "toggleTimer",
    descriptionKey: "settings.toggleTimerShortcut",
    defaultAccelerator: "CmdOrCtrl+Shift+Space",
  },
  {
    id: "quickAddTask",
    descriptionKey: "settings.quickAddTaskShortcut",
    defaultAccelerator: "CmdOrCtrl+Shift+A",
  },
];

// --- Capturing target type ---

type CapturingTarget =
  | { type: "inApp"; id: ShortcutId }
  | { type: "global"; id: string }
  | null;

// --- Main component ---

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
  const [capturingTarget, setCapturingTarget] = useState<CapturingTarget>(null);
  const [conflictInfo, setConflictInfo] = useState<{
    targetKey: string;
    label: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<ShortcutCategory>
  >(new Set());

  // Global shortcuts state
  const isDesktopEnv = useMemo(() => isTauri(), []);
  const [globalConfig, setGlobalConfig] = useState<Record<string, string>>({});
  const [globalDraft, setGlobalDraft] = useState<Record<string, string>>({});
  const [globalLoaded, setGlobalLoaded] = useState(false);

  const capturingRef = useRef(capturingTarget);
  capturingRef.current = capturingTarget;
  const draftRef = useRef(draftConfig);
  draftRef.current = draftConfig;
  const globalDraftRef = useRef(globalDraft);
  globalDraftRef.current = globalDraft;

  // Load global shortcuts
  useEffect(() => {
    if (!isDesktopEnv) return;
    const ds = getDataService();
    ds.getGlobalShortcuts()
      .then((gs) => {
        const defaults: Record<string, string> = {};
        for (const def of GLOBAL_SHORTCUT_DEFS) {
          defaults[def.id] = def.defaultAccelerator;
        }
        const merged = { ...defaults, ...(gs ?? {}) };
        setGlobalConfig(merged);
        setGlobalDraft(merged);
        setGlobalLoaded(true);
      })
      .catch(() => {
        setGlobalLoaded(true);
      });
  }, [isDesktopEnv]);

  // Sync draft when config changes externally (e.g. undo/redo)
  useEffect(() => {
    setDraftConfig({ ...config });
  }, [config]);

  const isInAppDirty = JSON.stringify(draftConfig) !== JSON.stringify(config);
  const isGlobalDirty =
    isDesktopEnv &&
    JSON.stringify(globalDraft) !== JSON.stringify(globalConfig);
  const isDirty = isInAppDirty || isGlobalDirty;

  const cancelCapture = useCallback(() => {
    setCapturingTarget(null);
    setConflictInfo(null);
  }, []);

  const handleCapture = useCallback(
    (e: KeyboardEvent) => {
      const target = capturingRef.current;
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        cancelCapture();
        return;
      }

      const binding = eventToBinding(e);
      if (!binding) return;

      if (target.type === "inApp") {
        const conflict = findDraftConflict(
          draftRef.current,
          binding,
          target.id,
        );
        if (conflict) {
          setConflictInfo({
            targetKey: target.id,
            label: t(conflict.descriptionKey),
          });
          return;
        }

        setDraftConfig((prev) => ({ ...prev, [target.id]: binding }));
        setCapturingTarget(null);
        setConflictInfo(null);
      } else {
        // Global shortcut capture
        const accel = keyBindingToAccelerator(binding);

        // Check conflict with other global shortcuts
        for (const def of GLOBAL_SHORTCUT_DEFS) {
          if (def.id === target.id) continue;
          const existingAccel =
            globalDraftRef.current[def.id] ?? def.defaultAccelerator;
          const existingBinding = acceleratorToKeyBinding(existingAccel);
          if (bindingsEqual(binding, existingBinding)) {
            setConflictInfo({
              targetKey: target.id,
              label: t(def.descriptionKey),
            });
            return;
          }
        }

        setGlobalDraft((prev) => ({ ...prev, [target.id]: accel }));
        setCapturingTarget(null);
        setConflictInfo(null);
      }
    },
    [t, cancelCapture],
  );

  useEffect(() => {
    if (!capturingTarget) return;
    window.addEventListener("keydown", handleCapture, true);
    return () => window.removeEventListener("keydown", handleCapture, true);
  }, [capturingTarget, handleCapture]);

  const handleSave = useCallback(async () => {
    onBeforeChange?.();

    if (isInAppDirty) {
      saveAllBindings(draftConfig);
    }

    if (isGlobalDirty) {
      try {
        const ds = getDataService();
        await ds.setGlobalShortcuts(globalDraft);
        const result = await ds.reregisterGlobalShortcuts();
        if (result.success) {
          setGlobalConfig({ ...globalDraft });
        } else {
          // Revert draft to last known good config
          setGlobalDraft({ ...globalConfig });
        }
      } catch {
        setGlobalDraft({ ...globalConfig });
      }
    }
  }, [
    draftConfig,
    saveAllBindings,
    onBeforeChange,
    isInAppDirty,
    isGlobalDirty,
    globalDraft,
    globalConfig,
  ]);

  const handleResetBinding = useCallback((id: ShortcutId) => {
    setDraftConfig((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleResetGlobalBinding = useCallback((id: string) => {
    const def = GLOBAL_SHORTCUT_DEFS.find((d) => d.id === id);
    if (def) {
      setGlobalDraft((prev) => ({ ...prev, [id]: def.defaultAccelerator }));
    }
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

  // Filter global shortcuts by search
  const filteredGlobalDefs = useMemo(() => {
    if (!isDesktopEnv || !globalLoaded) return [];
    if (activeCategory && activeCategory !== "global") return [];

    const lowerQuery = searchQuery.toLowerCase();
    return GLOBAL_SHORTCUT_DEFS.filter((def) => {
      if (!lowerQuery) return true;
      return t(def.descriptionKey).toLowerCase().includes(lowerQuery);
    });
  }, [isDesktopEnv, globalLoaded, activeCategory, searchQuery, t]);

  const hasResults = useMemo(() => {
    const hasInApp = Object.values(filteredByCategory).some(
      (items) => items.length > 0,
    );
    return hasInApp || filteredGlobalDefs.length > 0;
  }, [filteredByCategory, filteredGlobalDefs]);

  const showGlobalSection = filteredGlobalDefs.length > 0;

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

      {/* No results */}
      {!hasResults && searchQuery && (
        <p className="text-sm text-notion-text-secondary text-center py-8">
          {t("settings.shortcuts.noResults")}
        </p>
      )}

      {/* OS Global Shortcuts section */}
      {showGlobalSection && (
        <div>
          <div className="flex items-center gap-2 py-2">
            <Globe size={14} className="text-notion-text-secondary" />
            <div>
              <h3 className="text-sm font-semibold text-notion-text">
                {t("settings.shortcuts.osGlobalShortcuts")}
              </h3>
              <p className="text-[10px] text-notion-text-secondary/60">
                {t("settings.shortcuts.osGlobalShortcutsDesc")}
              </p>
            </div>
          </div>

          <div className="space-y-0.5 ml-1">
            {filteredGlobalDefs.map((def) => {
              const currentAccel =
                globalDraft[def.id] ?? def.defaultAccelerator;
              const binding = acceleratorToKeyBinding(currentAccel);
              const isModified = currentAccel !== def.defaultAccelerator;
              const isCapturing =
                capturingTarget?.type === "global" &&
                capturingTarget.id === def.id;

              return (
                <ShortcutRowBase
                  key={def.id}
                  descriptionKey={def.descriptionKey}
                  showMac={showMac}
                  isCapturing={isCapturing}
                  onStartCapture={() => {
                    setCapturingTarget({ type: "global", id: def.id });
                    setConflictInfo(null);
                  }}
                  onCancelCapture={cancelCapture}
                  binding={binding}
                  isModified={isModified}
                  onReset={() => handleResetGlobalBinding(def.id)}
                  conflictLabel={
                    conflictInfo?.targetKey === def.id
                      ? conflictInfo.label
                      : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Shortcut categories */}
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
                  const isCapturing =
                    capturingTarget?.type === "inApp" &&
                    capturingTarget.id === def.id;

                  return (
                    <ShortcutRowBase
                      key={def.id}
                      descriptionKey={def.descriptionKey}
                      showMac={showMac}
                      isCapturing={isCapturing}
                      onStartCapture={() => {
                        setCapturingTarget({ type: "inApp", id: def.id });
                        setConflictInfo(null);
                      }}
                      onCancelCapture={cancelCapture}
                      binding={binding}
                      isModified={isModified}
                      onReset={() => handleResetBinding(def.id)}
                      conflictLabel={
                        conflictInfo?.targetKey === def.id
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
