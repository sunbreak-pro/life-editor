import { useMemo } from "react";
import {
  SettingsAppearance,
  SettingsLanguage,
  SettingsShortcuts,
  SettingsDetailPanel,
  RightSidebarPortal,
  DEFAULT_SHORTCUTS,
  fontSizeToPx,
  useThemeContext,
  useShortcutConfig,
  useMediaQuery,
  useTranslation,
  type ShortcutRow,
  type ShortcutCategory,
  type KeyBinding,
  type ShortcutId,
} from "@life-editor/shared";

/*
 * Settings screen (W1, web host — redesigned). Centered single column
 * (max-width 768px): page header + Appearance / Language / Shortcuts cards
 * (opaque, immediate-apply, no save button). This is the HOST side: it owns
 * the hooks (useThemeContext / useShortcutConfig / useTranslation / media
 * query) and injects values + setters + already-translated copy into the
 * shared PURE primitives (CLAUDE.md §6.4). The Shortcuts card is Desktop-only
 * (ShortcutConfig is a Mobile 省略 Provider — §2). A live appearance preview +
 * tips are pushed into the shared detail panel via RightSidebarPortal.
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const { theme, fontSize, language, setTheme, setFontSize, setLanguage } =
    useThemeContext();
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
  const themeLabel =
    theme === "light" ? t("settings.light") : t("settings.dark");

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
    <div className="mx-auto flex max-w-[768px] flex-col gap-6 pb-12">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold text-lumen-text">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-lumen-text-secondary">
          {t("settings.pageDescription")}
        </p>
      </div>

      <div className={cardClass}>
        <SettingsAppearance
          theme={theme}
          fontSize={fontSize}
          onThemeChange={setTheme}
          onFontSizeChange={setFontSize}
          touch={!isWide}
          labels={{
            heading: t("settings.appearance"),
            theme: t("settings.theme"),
            light: t("settings.light"),
            dark: t("settings.dark"),
            fontSize: t("settings.fontSize"),
            fontSizeValue,
            fontSizeSmall: t("settings.fontSizeSmall"),
            fontSizeLarge: t("settings.fontSizeLarge"),
            previewText: t("settings.previewText"),
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
