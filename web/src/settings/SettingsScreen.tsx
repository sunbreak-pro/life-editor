import { useMemo } from "react";
import {
  SettingsAppearance,
  SettingsLanguage,
  SettingsShortcuts,
  DEFAULT_SHORTCUTS,
  useThemeContext,
  useShortcutConfig,
  useTranslation,
  type ShortcutRow,
  type KeyBinding,
  type ShortcutId,
} from "@life-editor/shared";

/*
 * Settings screen (W1, web host). Responsive single column — Appearance /
 * Language / Shortcuts stacked vertically. This is the HOST side: it owns the
 * hooks (useThemeContext / useShortcutConfig / useTranslation) and injects
 * values + setters + already-translated copy into the shared PURE primitives
 * (CLAUDE.md §6.4 — primitives never call useTranslation / context). The
 * frontend's portal-based 25-subsection layout is intentionally NOT ported.
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const { theme, fontSize, language, setTheme, setFontSize, setLanguage } =
    useThemeContext();

  // Optional (Mobile 省略 Provider). On web the Provider is always mounted, so
  // this is non-null here; guard anyway to satisfy the null-safe contract.
  const shortcuts = useShortcutConfig();

  const rows: ShortcutRow[] = useMemo(() => {
    if (!shortcuts) return [];
    return DEFAULT_SHORTCUTS.map((def) => ({
      id: def.id,
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

  return (
    <div className="space-y-10">
      <SettingsAppearance
        theme={theme}
        fontSize={fontSize}
        onThemeChange={setTheme}
        onFontSizeChange={setFontSize}
        labels={{
          heading: t("settings.appearance"),
          darkMode: t("settings.darkMode"),
          darkModeDesc: t("settings.darkModeDesc"),
          light: t("settings.light"),
          dark: t("settings.dark"),
          fontSize: t("settings.fontSize"),
          fontSizeSmall: t("settings.fontSizeSmall"),
          fontSizeLarge: t("settings.fontSizeLarge"),
        }}
      />

      <SettingsLanguage
        language={language}
        onLanguageChange={setLanguage}
        labels={{
          heading: t("settings.language"),
          description: t("settings.languageDesc"),
          english: t("settings.english"),
          japanese: t("settings.japanese"),
        }}
      />

      {shortcuts && (
        <SettingsShortcuts
          rows={rows}
          onRebind={shortcuts.setBinding}
          onResetOne={shortcuts.resetBinding}
          onResetAll={shortcuts.resetAll}
          getConflictLabel={getConflictLabel}
          labels={{
            heading: t("settings.shortcuts.heading"),
            resetAll: t("settings.shortcuts.resetAll"),
            change: t("settings.shortcuts.change"),
            reset: t("settings.shortcuts.reset"),
            pressKey: t("settings.shortcuts.pressKey"),
            cancel: t("settings.shortcuts.cancel"),
            modified: t("settings.shortcuts.modified"),
            conflictTemplate: t("settings.shortcuts.conflict", {
              action: "{{action}}",
            }),
          }}
        />
      )}
    </div>
  );
}
