import { useEffect, useMemo, useState } from "react";
import {
  SettingsAccount,
  SettingsAppearance,
  SettingsLanguage,
  SettingsShortcuts,
  SettingsGeneral,
  SettingsDayStart,
  SettingsReset,
  SettingsTutorial,
  SettingsDetailPanel,
  getSession,
  RightSidebarPortal,
  ConfirmDialog,
  useConfirmDialog,
  DEFAULT_SHORTCUTS,
  MAIN_SECTIONS,
  PASSWORD_MIN_LENGTH,
  fontSizeToPx,
  useThemeContext,
  useShortcutConfig,
  useStartupSectionPref,
  useDayStartHourPref,
  useTourContext,
  resetLocalPreferences,
  useMediaQuery,
  useTranslation,
  type ShortcutRow,
  type ShortcutCategory,
  type KeyBinding,
  type ShortcutId,
  WIDE_QUERY,
} from "@life-editor/shared";
import { usePasswordUpdate } from "../hooks/usePasswordUpdate";

/*
 * Settings screen (W1, web host — redesigned; §216 lightweight prefs). Single
 * column of cards (opaque, immediate-apply, no save button) — the order below
 * is the layout. The section title lives in the shell's
 * standard SectionHeader (Layout Standard v2, #209). Width + gutter + scroll
 * are owned by the PageContainer wrapper in MainScreen. This is the HOST side:
 * it owns the hooks (useThemeContext / useShortcutConfig / useStartupSectionPref
 * / useDayStartHourPref / useTranslation / media query) and injects values +
 * setters + already-translated copy into the shared PURE primitives
 * (CLAUDE.md §6.4). The
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
  const { dayStartHour, setDayStartHour } = useDayStartHourPref();
  /*
   * Tutorial re-run (#1123). REQUIRED Provider, unlike useShortcutConfig below
   * — the tour is global and mounted on every shell, so there is no null case
   * and no card to hide. `restart` clears the stored position and walks from
   * step one; the tour navigates itself off this screen from there.
   */
  const { restart: restartTour } = useTourContext();
  const isWide = useMediaQuery(WIDE_QUERY);

  // Optional (Mobile 省略 Provider): null on the native Capacitor shells,
  // where ShortcutConfigHost skips the Provider (#320) — the Shortcuts card
  // below renders only when the value is present.
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

  /*
   * Reset preferences — the host owns the destructive confirm + clear-and-
   * reload (the pure SettingsReset primitive only raises onReset).
   * `resetLocalPreferences()` clears the app's localStorage namespace and
   * reloads, so this is the one press on this screen that cannot be taken back:
   * `danger`, and the safe answer is the one focus lands on.
   *
   * #781: asked through the in-app <ConfirmDialog> (#707) like every other
   * question in the app. The browser's own confirm answered inline; this one
   * answers a tick later, so the reset runs in a `.then` — and until it does,
   * nothing has been cleared.
   */
  const {
    request: confirmRequest,
    ask: askConfirm,
    resolve: resolveConfirm,
  } = useConfirmDialog();
  const handleReset = () => {
    void askConfirm({
      message: t("settings.reset.confirm"),
      confirmLabel: t("settings.reset.confirmButton"),
      cancelLabel: t("common.cancel"),
      danger: true,
    }).then((ok) => {
      if (ok) resetLocalPreferences();
    });
  };

  /*
   * Account card (#919). The address is read from the session rather than
   * threaded down from MainScreen: sectionDescriptors renders this screen with
   * no props, and a one-shot read here is cheaper than widening that contract
   * for a single string.
   */
  const [accountEmail, setAccountEmail] = useState("");
  useEffect(() => {
    let active = true;
    void getSession()
      .then((s) => {
        if (active) setAccountEmail(s?.user.email ?? "");
      })
      // The address is decoration on a form that works without it, so a client
      // that cannot even be constructed (no credentials — the shape tests run
      // in) must not take the screen down with it.
      .catch((e: unknown) => console.error("[settings] getSession", e));
    return () => {
      active = false;
    };
  }, []);

  const passwordMessages = useMemo(
    () => ({
      mismatch: t("settings.account.errors.mismatch"),
      tooShort: t("settings.account.errors.tooShort", {
        min: PASSWORD_MIN_LENGTH,
      }),
      samePassword: t("settings.account.errors.samePassword"),
      generic: t("settings.account.errors.generic"),
      done: t("settings.account.done"),
    }),
    [t],
  );
  const passwordForm = usePasswordUpdate(passwordMessages);

  const detailTodos = [
    { label: t("settings.detail.todos.shopping"), done: false },
    { label: t("settings.detail.todos.coffee"), done: true },
    { label: t("settings.detail.todos.dinner"), done: false },
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
        <SettingsDayStart
          value={dayStartHour}
          onChange={setDayStartHour}
          labels={{
            heading: t("settings.dayStart.heading"),
            description: t("settings.dayStart.description"),
            hourLabel: t("settings.dayStart.hourLabel"),
            hint: t("settings.dayStart.hint"),
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
        <SettingsAccount
          email={accountEmail}
          password={passwordForm.password}
          onPasswordChange={passwordForm.setPassword}
          confirmPassword={passwordForm.confirmPassword}
          onConfirmPasswordChange={passwordForm.setConfirmPassword}
          error={passwordForm.error}
          notice={passwordForm.notice}
          confirmInvalid={passwordForm.confirmInvalid}
          busy={passwordForm.busy}
          onSubmit={passwordForm.submit}
          labels={{
            heading: t("settings.account.heading"),
            description: t("settings.account.description"),
            emailLabel: t("settings.account.emailLabel"),
            newPassword: t("settings.account.newPassword"),
            newPasswordHelper: t("settings.account.newPasswordHelper", {
              min: PASSWORD_MIN_LENGTH,
            }),
            confirmPassword: t("settings.account.confirmPassword"),
            showPassword: t("auth.showPassword"),
            hidePassword: t("auth.hidePassword"),
            submit: t("settings.account.submit"),
            busy: t("settings.account.busy"),
          }}
        />
      </div>

      <div className={cardClass}>
        <SettingsTutorial
          onRestart={restartTour}
          labels={{
            heading: t("settings.tutorial.heading"),
            description: t("settings.tutorial.description"),
            button: t("settings.tutorial.button"),
          }}
        />
      </div>

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
          todos={detailTodos}
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

      {confirmRequest && (
        <ConfirmDialog
          open
          message={confirmRequest.message}
          confirmLabel={confirmRequest.confirmLabel}
          cancelLabel={confirmRequest.cancelLabel}
          danger={confirmRequest.danger}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}
    </div>
  );
}
