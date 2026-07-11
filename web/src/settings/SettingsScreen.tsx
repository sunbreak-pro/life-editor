import { useMemo } from "react";
import {
  SettingsAppearance,
  SettingsLanguage,
  SettingsShortcuts,
  SettingsGeneral,
  SettingsReset,
  SettingsDetailPanel,
  RightSidebarPortal,
  DEFAULT_SHORTCUTS,
  MAIN_SECTIONS,
  fontSizeToPx,
  useThemeContext,
  useShortcutConfig,
  useStartupSectionPref,
  resetLocalPreferences,
  useMediaQuery,
  useTranslation,
  type ShortcutRow,
  type ShortcutCategory,
  type KeyBinding,
  type ShortcutId,
} from "@life-editor/shared";

/*
 * Settings screen (W1, web host — redesigned; §216 lightweight prefs). Single
 * column of Appearance / General / Language / Shortcuts / Reset cards (opaque,
 * immediate-apply, no save button). The section title lives in the shell's
 * standard SectionHeader (Layout Standard v2, #209). Width + gutter + scroll
 * are owned by the PageContainer wrapper in MainScreen. This is the HOST side:
 * it owns the hooks (useThemeContext / useShortcutConfig / useStartupSectionPref
 * / useTranslation / media query) and injects values + setters + already-
 * translated copy into the shared PURE primitives (CLAUDE.md §6.4). The
 * Shortcuts card is Desktop-only (ShortcutConfig is a Mobile 省略 Provider —
 * §2). The Reset card owns the destructive confirm + clear-and-reload (kept out
 * of the pure primitive). A live appearance preview + tips are pushed into the
 * shared detail panel via RightSidebarPortal.
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const {
    theme,
    themeMode,
    fontSize,
    fontFamily,
    reduceMotion,
    language,
    setThemeMode,
    setFontSize,
    setFontFamily,
    setReduceMotion,
    setLanguage,
  } = useThemeContext();
  const { pref: startupPref, setPref: setStartupPref } =
    useStartupSectionPref();
  const isWide = useMediaQuery("(min-width: 768px)");

  // Optional (Mobile 省略 Provider). On web the Provider is always mounted, so
  // this is non-null here; guard anyway to satisfy the null-safe contract.
  const shortcuts = useShortcutConfig();

  const px = fontSizeToPx(fontSize);
  const fontSizeValue = t("settings.fontSizeValue", {
    px,
    step: fontSize,
    max: 10,
  });
  // Detail-summary theme label reflects the CHOICE (system shows "System",
  // otherwise the resolved light/dark). `theme` (resolved) still drives the
  // preview surface itself.
  const themeLabel =
    themeMode === "system"
      ? t("settings.themeSystem")
      : theme === "light"
        ? t("settings.light")
        : t("settings.dark");

  // Startup options: the "resume" entry first, then the mainline content
  // sections only (MAIN_SECTIONS — utility sections trash/settings are not
  // sensible landing screens). All resolved to translated copy here (§6.4).
  const startupOptions = useMemo(
    () => [
      { value: "last", label: t("settings.startup.lastVisited") },
      ...MAIN_SECTIONS.map((s) => ({
        value: s.id,
        label: t(s.labelKey, { defaultValue: s.id }),
      })),
    ],
    [t],
  );

  const rows: ShortcutRow[] = useMemo(() => {
    if (!shortcuts) return [];
    return DEFAULT_SHORTCUTS.map((def) => ({
      id: def.id,
      category: def.category,
      label: t(def.descriptionKey),
      displayString: shortcuts.getDisplayString(def.id),
      isModified: def.id in shortcuts.config,
    }));
  }, [shortcuts, t]);

  const getConflictLabel = useMemo(
    () =>
      (binding: KeyBinding, id: ShortcutId): string | null => {
        if (!shortcuts) return null;
        const conflict = shortcuts.findConflict(binding, id);
        return conflict ? t(conflict.descriptionKey) : null;
      },
    [shortcuts, t],
  );

  const categoryLabels: Record<ShortcutCategory, string> = {
    global: t("settings.shortcuts.categories.global"),
    navigation: t("settings.shortcuts.categories.navigation"),
    edit: t("settings.shortcuts.categories.edit"),
  };

  // Reset preferences — the host owns the destructive confirm + clear-and-
  // reload (the pure SettingsReset primitive only raises onReset). window.confirm
  // is the app's existing lightweight confirm affordance for a one-shot
  // destructive action; resetLocalPreferences() then clears the app's
  // localStorage namespace and reloads.
  const handleReset = () => {
    if (window.confirm(t("settings.reset.confirm"))) {
      resetLocalPreferences();
    }
  };

  const detailTasks = [
    { label: t("settings.detail.tasks.shopping"), done: false },
    { label: t("settings.detail.tasks.coffee"), done: true },
    { label: t("settings.detail.tasks.dinner"), done: false },
  ];

  const detailTips = [
    {
      title: t("settings.detail.tips.immediate.title"),
      body: t("settings.detail.tips.immediate.body"),
    },
    {
      title: t("settings.detail.tips.fontSize.title"),
      body: t("settings.detail.tips.fontSize.body"),
    },
    {
      title: t("settings.detail.tips.palette.title"),
      body: t("settings.detail.tips.palette.body"),
    },
  ];

  const cardClass =
    "rounded-lumen-lg border border-lumen-border bg-lumen-bg p-5 shadow-lumen-sm md:px-6";

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className={cardClass}>
        <SettingsAppearance
          themeMode={themeMode}
          fontSize={fontSize}
          fontFamily={fontFamily}
          reduceMotion={reduceMotion}
          onThemeModeChange={setThemeMode}
          onFontSizeChange={setFontSize}
          onFontFamilyChange={setFontFamily}
          onReduceMotionChange={setReduceMotion}
          touch={!isWide}
          labels={{
            heading: t("settings.appearance"),
            theme: t("settings.theme"),
            light: t("settings.light"),
            dark: t("settings.dark"),
            system: t("settings.themeSystem"),
            fontSize: t("settings.fontSize"),
            fontSizeValue,
            fontSizeSmall: t("settings.fontSizeSmall"),
            fontSizeLarge: t("settings.fontSizeLarge"),
            previewText: t("settings.previewText"),
            fontFamily: t("settings.fontFamilyLabel"),
            fontFamilyDesc: t("settings.fontFamilyDesc"),
            fontFamilySystem: t("settings.fontFamilySystem"),
            fontFamilySerif: t("settings.fontFamilySerif"),
            fontFamilyMono: t("settings.fontFamilyMono"),
            reduceMotion: t("settings.reduceMotionLabel"),
            reduceMotionDesc: t("settings.reduceMotionDesc"),
            reduceMotionSystem: t("settings.reduceMotionSystem"),
            reduceMotionReduce: t("settings.reduceMotionReduce"),
            reduceMotionOff: t("settings.reduceMotionOff"),
          }}
        />
      </div>

      <div className={cardClass}>
        <SettingsGeneral
          value={startupPref}
          onChange={(value) => setStartupPref(value as typeof startupPref)}
          options={startupOptions}
          labels={{
            heading: t("settings.startup.heading"),
            description: t("settings.startup.description"),
            sectionLabel: t("settings.startup.sectionLabel"),
          }}
        />
      </div>

      <div className={cardClass}>
        <SettingsLanguage
          language={language}
          onLanguageChange={setLanguage}
          stacked={!isWide}
          labels={{
            heading: t("settings.language"),
            description: t("settings.languageDesc"),
            english: t("settings.english"),
            japanese: t("settings.japanese"),
          }}
        />
      </div>

      {isWide && shortcuts && (
        <div className={cardClass}>
          <SettingsShortcuts
            rows={rows}
            config={shortcuts.config}
            onRebind={shortcuts.setBinding}
            onResetOne={shortcuts.resetBinding}
            onResetAll={shortcuts.resetAll}
            getConflictLabel={getConflictLabel}
            labels={{
              heading: t("settings.shortcuts.heading"),
              resetAll: t("settings.shortcuts.resetAll"),
              change: t("settings.shortcuts.change"),
              reset: t("settings.shortcuts.reset"),
              modified: t("settings.shortcuts.modified"),
              cancel: t("settings.shortcuts.cancel"),
              done: t("settings.shortcuts.done"),
              editTitle: t("settings.shortcuts.editTitle"),
              editDescription: t("settings.shortcuts.editDescription"),
              waiting: t("settings.shortcuts.waiting"),
              conflictTemplate: t("settings.shortcuts.conflict", {
                action: "{{action}}",
              }),
              categories: categoryLabels,
            }}
          />
        </div>
      )}

      <div className={cardClass}>
        <SettingsReset
          onReset={handleReset}
          labels={{
            heading: t("settings.reset.heading"),
            description: t("settings.reset.description"),
            button: t("settings.reset.button"),
          }}
        />
      </div>

      <RightSidebarPortal>
        <SettingsDetailPanel
          fontPx={px}
          tasks={detailTasks}
          tips={detailTips}
          labels={{
            previewHeading: t("settings.detail.previewHeading"),
            windowTitle: t("settings.detail.windowTitle"),
            previewTitle: t("settings.detail.previewTitle"),
            appearanceSummary: t("settings.detail.appearanceSummary", {
              theme: themeLabel,
              fontValue: fontSizeValue,
            }),
            tipsHeading: t("settings.detail.tipsHeading"),
          }}
        />
      </RightSidebarPortal>
    </div>
  );
}
