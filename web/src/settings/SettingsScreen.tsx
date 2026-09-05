import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  SettingsAccount,
  SettingsAiIntegration,
  SettingsAppearance,
  SettingsLegal,
  SettingsLanguage,
  SettingsShortcuts,
  SettingsGeneral,
  SettingsSchedule,
  SettingsDayStart,
  SettingsReset,
  SettingsTutorial,
  SettingsTabsNav,
  TourLauncherModal,
  SettingsDetailPanel,
  DeleteAccountDialog,
  EmptyState,
  Modal,
  Button,
  getSession,
  signOut,
  deleteAccount,
  RightSidebarPortal,
  ConfirmDialog,
  useConfirmDialog,
  DEFAULT_SHORTCUTS,
  MAIN_SECTIONS,
  SECTIONS,
  TOUR_SECTION_IDS,
  TOUR_SECTION_SUMMARY_KEYS,
  PASSWORD_MIN_LENGTH,
  fontSizeToPx,
  useThemeContext,
  useShortcutConfig,
  useStartupSectionPref,
  useScheduleInitialViewPref,
  useReminderPrefs,
  REMINDER_LEAD_CHOICES,
  useDayStartHourPref,
  useRightSidebarOptional,
  useTourContext,
  resetLocalPreferences,
  useMediaQuery,
  useTranslation,
  getDataService,
  isMac,
  lastBriefingDate,
  MCP_TOOL_CATALOG,
  type SettingsTabItem,
  type TourLauncherSection,
  type ShortcutRow,
  type ShortcutCategory,
  type KeyBinding,
  type ShortcutId,
  WIDE_QUERY,
} from "@life-editor/shared";
import { usePasswordUpdate } from "../hooks/usePasswordUpdate";
import { useClaudeLauncher } from "../hooks/useClaudeLauncher";
import { TrashScreen } from "../trash/TrashScreen";
import { AttachmentCleanupCard } from "../trash/AttachmentCleanupCard";
import { openLegalDocument } from "../legal/legalUrl";

/*
 * Settings screen (W1, web host — redesigned; §216 lightweight prefs). This is
 * the HOST side: it owns the hooks (useThemeContext / useShortcutConfig /
 * useStartupSectionPref / useScheduleInitialViewPref / useDayStartHourPref /
 * useTranslation / media query) and injects values + setters +
 * already-translated copy into the shared PURE primitives (CLAUDE.md §6.4).
 * The section title lives in the shell's standard SectionHeader (Layout
 * Standard v2, #209); width + gutter + scroll are owned by the PageContainer
 * wrapper in MainScreen.
 *
 * #1174 turned the screen into CATEGORIES. The rightSidebar face used to hold
 * an appearance preview + tips; it now holds the category list, and the body
 * below shows one category at a time:
 *
 *   General — every preference that was already here, in the order it was in
 *   Schedule — the initial calendar view (the first per-section preference)
 *   briefing / materials / work / analytics — receptacles, so the list is the
 *     whole map of what Settings will cover rather than only what exists today
 *   Trash — not a preference either, but a PLACE (#1293). It used to be a
 *     sidebar section of its own, which spent a permanent nav row (and a
 *     mobile More slot) on somewhere you visit to undo something. The view is
 *     unchanged — the same <TrashScreen> renders under this row.
 *   Tips — not a category at all: the last row raises the old preview + tips
 *     panel in the CENTRE of the screen, which is where something you read
 *     belongs (it was competing with the controls for the same 320px column).
 *
 * The Shortcuts card stays Desktop-only (ShortcutConfig is a Mobile 省略
 * Provider — §2) and the Reset card still owns the destructive confirm +
 * clear-and-reload (kept out of the pure primitive).
 */

/** Category ids, in the order the rightSidebar lists them (#1174). */
const SECTION_TAB_IDS = [
  "briefing",
  "schedule",
  "materials",
  "work",
  "analytics",
] as const;

type SettingsTabId = "general" | "trash" | (typeof SECTION_TAB_IDS)[number];

/** The one row that opens a dialog instead of swapping the body. */
const TIPS_ROW_ID = "tips";

/** The row that shows the Trash view rather than a set of preferences (#1293). */
const TRASH_TAB_ID = "trash";

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
  const { initialView, setInitialView } = useScheduleInitialViewPref();
  const {
    remindersEnabled,
    setRemindersEnabled,
    defaultLeadMinutes,
    setDefaultLeadMinutes,
  } = useReminderPrefs();
  /*
   * Tutorial (#1123, given a launcher by #1194). REQUIRED Provider, unlike
   * useShortcutConfig below — the tour is global and mounted on every shell,
   * so there is no null case and no card to hide.
   *
   * Two doors, both of which navigate off this screen on their own: `restart`
   * clears the stored position and walks every section from step one, and
   * `startSection` walks one section, leaving that position alone — it keeps
   * a bookmark of its own instead, so an interrupted replay continues where
   * it stopped without the full tour ever seeing it (#1359).
   */
  const { restart: restartTour, startSection: startTourSection } =
    useTourContext();
  const isWide = useMediaQuery(WIDE_QUERY);

  // Optional (Mobile 省略 Provider): null on the native Capacitor shells,
  // where ShortcutConfigHost skips the Provider (#320) — the Shortcuts card
  // below renders only when the value is present.
  const shortcuts = useShortcutConfig();

  const [tab, setTab] = useState<SettingsTabId>("general");
  const [tipsOpen, setTipsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /*
   * #1174: the detail panel is this screen's NAVIGATION now, not a decoration
   * beside it, so Settings asks for it once on the way in — a fresh session
   * starts with the panel closed (RightSidebarProvider), which would have left
   * the category list reachable only through the header toggle.
   *
   * Wide only, and once per visit: on narrow the same face is a modal drawer
   * over the content, and throwing that up the moment someone opens Settings
   * is a different (worse) thing than pushing a column aside. The ref is what
   * keeps a later resize from re-opening a panel the user closed on purpose.
   *
   * Optional hook (§4): outside a Provider — the screen's own suites, a
   * standalone render — this is simply null and nothing happens.
   */
  const rightSidebar = useRightSidebarOptional();
  const openPanel = rightSidebar?.open;
  const askedForPanelRef = useRef(false);
  useEffect(() => {
    if (askedForPanelRef.current || !isWide || !openPanel) return;
    askedForPanelRef.current = true;
    openPanel();
  }, [isWide, openPanel]);

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

  /*
   * The tutorial launcher's menu (#1194).
   *
   * MAIN_SECTIONS, not SECTIONS: the launcher's first page is "what this app
   * is", and Settings and Trash are not places the app is for — they are the
   * same two rows `startupOptions` above leaves out, for the same reason.
   *
   * `hasSteps` is read off TOUR_SECTION_IDS, which the registry derives from
   * the step list itself. A section therefore becomes pickable the moment its
   * steps land and not one edit sooner, and no literal here can claim a
   * walkthrough that does not exist. Summary copy is keyed the same way the
   * label is — through a typed key map, so an untranslated section fails at
   * compile time rather than showing a raw key (#726).
   */
  const tourSections: TourLauncherSection[] = useMemo(
    () =>
      MAIN_SECTIONS.map((s) => {
        const Icon = s.icon;
        const id = s.id as TourLauncherSection["id"];
        return {
          id,
          label: t(s.labelKey),
          summary: t(TOUR_SECTION_SUMMARY_KEYS[id]),
          icon: <Icon size={18} />,
          hasSteps: TOUR_SECTION_IDS.includes(id),
        };
      }),
    [t],
  );

  /*
   * The category list. The five per-section rows take their icon AND their
   * label key from the section registry (sections.ts SSOT) rather than a
   * second literal list here, so a settings category cannot end up wearing a
   * different glyph or name than the sidebar row it belongs to. General and
   * Tips are this screen's own, so they bring their own.
   */
  const tabs: SettingsTabItem[] = useMemo(() => {
    const sectionRows = SECTION_TAB_IDS.map((id) => {
      const def = SECTIONS.find((s) => s.id === id);
      const Icon = def?.icon;
      return {
        id,
        // No defaultValue: `labelKey` is typed as the catalog's key union
        // (#726), so a section whose label was never translated is a compile
        // error rather than a row that quietly says "work".
        label: def ? t(def.labelKey) : id,
        icon: Icon ? <Icon size={16} /> : null,
      };
    });
    return [
      {
        id: "general",
        label: t("settings.tabs.general"),
        icon: <SlidersHorizontal size={16} />,
      },
      ...sectionRows,
      // Trash sits after the per-section rows and before Tips: it is the one
      // row that opens a place rather than a set of preferences, and Tips is
      // the one row that opens a dialog. Both belong at the end, in that
      // order — the list stays "settings, then the ways out of it".
      {
        id: TRASH_TAB_ID,
        label: t("settings.tabs.trash"),
        icon: <Trash2 size={16} />,
      },
      {
        id: TIPS_ROW_ID,
        label: t("settings.tabs.tips"),
        icon: <Lightbulb size={16} />,
        opensPanel: true,
      },
    ];
  }, [t]);

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

  /*
   * Last AI activity for the integration card (#1210).
   *
   * Read here rather than passed in: like `getSession()` above, this screen is
   * rendered with no props, and the answer is one string. Dailies come back
   * whole because that is the only list call there is — the derivation itself
   * (newest day carrying a briefing section) is a pure helper in shared, so
   * what runs here is a fetch and nothing else.
   *
   * `undefined` while in flight, `null` once we know there is nothing — the
   * card shows a checking line for the first and a "not yet" sentence for the
   * second, which are different facts. A failure (no credentials, offline)
   * lands on `null` too: the card is decoration on a screen that works without
   * it and must not take Settings down.
   */
  const [lastBriefing, setLastBriefing] = useState<string | null | undefined>(
    undefined,
  );
  useEffect(() => {
    let active = true;
    // getDataService() THROWS SYNCHRONOUSLY when the app has no Supabase
    // credentials — the shape suites run exactly there. Building the service
    // inside the async body turns that into a rejection like any other, so the
    // one `.catch` below covers both "could not connect" and "could not even
    // be constructed"; a `.catch` on the promise alone would never see it.
    const read = async () =>
      lastBriefingDate(await getDataService().listDailiesUnified());
    void read()
      .then((date) => {
        if (active) setLastBriefing(date);
      })
      .catch((e: unknown) => {
        console.error("[settings] listDailiesUnified", e);
        if (active) setLastBriefing(null);
      });
    return () => {
      active = false;
    };
  }, []);

  // Claude Code launcher (#1211) — no-op shape off the desktop shell.
  const claudeLauncher = useClaudeLauncher();

  const aiLastActivity =
    lastBriefing === undefined
      ? null
      : lastBriefing === null
        ? t("settings.ai.activityNone")
        : t("settings.ai.activityValue", { date: lastBriefing });

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

  /*
   * Account deletion (#1200). The host owns the whole flow because it is the
   * only place that can: the card raises a request, the dialog collects the
   * typed address, and this is where the Edge Function is called.
   *
   * Nothing is reset on success. The account is gone, `deleteAccount()` has
   * already thrown the local token away, and the SIGNED_OUT that follows takes
   * this screen down with it — clearing state here would only be racing the
   * unmount. On FAILURE the dialog stays open with the message, because the
   * account still exists and the user may well want to try again.
   */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openDelete = () => {
    setDeleteInput("");
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    setDeleteBusy(true);
    setDeleteError(null);
    void deleteAccount()
      .then(({ error }) => {
        setDeleteBusy(false);
        if (error) setDeleteError(t("settings.account.delete.error"));
      })
      .catch((e: unknown) => {
        console.error("[settings] deleteAccount", e);
        setDeleteBusy(false);
        setDeleteError(t("settings.account.delete.error"));
      });
  };

  const deleteConsequences = [
    t("settings.account.delete.consequences.data"),
    t("settings.account.delete.consequences.login"),
    t("settings.account.delete.consequences.irreversible"),
  ];

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
      /* The modifier the rest of this screen already prints (the command
         palette row + the shortcut list) — the copy used to bake in ⌘K, so
         Windows read two different names for one key on one screen. */
      title: t("settings.detail.tips.palette.title", {
        shortcut: isMac ? "⌘K" : "Ctrl K",
      }),
      body: t("settings.detail.tips.palette.body"),
    },
  ];

  /*
   * The DataService for the Trash body (#1293). Settings is a HOST, so calling
   * the singleton here is allowed (§6.4) — but `getDataService()` THROWS
   * SYNCHRONOUSLY when the app has no Supabase credentials, which is exactly
   * where the shape suites run. Catching it into `null` keeps that throw from
   * taking the whole Settings screen down over one category nobody opened;
   * the row then says why it is empty instead of showing a list it cannot
   * fetch.
   */
  const trashService = useMemo(() => {
    try {
      return getDataService();
    } catch (e: unknown) {
      console.error("[settings] getDataService", e);
      return null;
    }
  }, []);

  const cardClass =
    "rounded-lumen-lg border border-lumen-border bg-lumen-bg p-5 shadow-lumen-sm md:px-6";

  // A category with nothing in it yet still gets a card, not a blank column:
  // the row is reachable from the list, so it has to say WHY it is empty.
  const placeholder = (
    <div className={cardClass}>
      <EmptyState
        icon={<SlidersHorizontal />}
        message={t("settings.placeholder.message")}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pb-12">
      {tab === "general" && (
        <>
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
                fontSizePresetSmall: t("settings.fontSizePresetSmall"),
                fontSizePresetMedium: t("settings.fontSizePresetMedium"),
                fontSizePresetLarge: t("settings.fontSizePresetLarge"),
                fontSizePx: t("settings.fontSizePx", { px }),
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
                signOutHeading: t("settings.account.signOut.heading"),
                signOutDescription: t("settings.account.signOut.description"),
                signOutButton: t("settings.account.signOut.button"),
                deleteHeading: t("settings.account.delete.heading"),
                deleteDescription: t("settings.account.delete.description"),
                deleteButton: t("settings.account.delete.button"),
              }}
              onSignOut={() => void signOut()}
              onDeleteAccount={openDelete}
            />
          </div>

          <div className={cardClass}>
            <SettingsTutorial
              onOpen={() => setTutorialOpen(true)}
              labels={{
                heading: t("settings.tutorial.heading"),
                description: t("settings.tutorial.description"),
                button: t("settings.tutorial.button"),
              }}
            />
          </div>

          {/*
           * AI integration (#1210). General, not a per-section category: the
           * MCP connection reaches every section's data, so it belongs with
           * the settings that describe the app rather than under any one of
           * them. Above Legal and Reset for the same reason Account is —
           * things you read about the app, then things that change it.
           */}
          <div className={cardClass}>
            <SettingsAiIntegration
              tools={MCP_TOOL_CATALOG}
              lastActivity={aiLastActivity}
              /*
               * Desktop-only (#1211). `available` is false in the browser and
               * inside the Capacitor shells, and the card then shows the
               * "desktop app" sentence instead of a button with no CLI behind
               * it. The field's value is held out here rather than in the card
               * because it is seeded by an async read of the desktop bridge.
               */
              launcher={
                claudeLauncher.available
                  ? {
                      projectPath: claudeLauncher.projectPath,
                      onProjectPathChange: claudeLauncher.setProjectPath,
                      onLaunch: () =>
                        claudeLauncher.launch(claudeLauncher.projectPath),
                    }
                  : undefined
              }
              labels={{
                heading: t("settings.ai.heading"),
                description: t("settings.ai.description"),
                activityHeading: t("settings.ai.activityHeading"),
                activityLoading: t("settings.ai.activityLoading"),
                activityCaveat: t("settings.ai.activityCaveat"),
                toolsHeading: t("settings.ai.toolsHeading"),
                // The count comes from the generated catalog, never a literal
                // here — the number moves when a tool is added (数値の非複製原則).
                toolsCount: t("settings.ai.toolsCount", {
                  n: MCP_TOOL_CATALOG.length,
                }),
                show: t("settings.ai.show"),
                hide: t("settings.ai.hide"),
                argsLabel: t("settings.ai.argsLabel"),
                argsNone: t("settings.ai.argsNone"),
                launchHeading: t("settings.ai.launchHeading"),
                launchDescription: t("settings.ai.launchDescription"),
                pathLabel: t("settings.ai.pathLabel"),
                pathPlaceholder: t("settings.ai.pathPlaceholder"),
                launchButton: t("settings.ai.launchButton"),
                launching: t("settings.ai.launching"),
                launched: t("settings.ai.launched"),
                desktopOnly: t("settings.ai.desktopOnly"),
              }}
            />
          </div>

          {/*
           * #1251 — the documents shipped with #1198 but only the sign-in
           * screen linked them, so they became unreachable the moment an
           * account existed. The reader itself is mounted in App; this card
           * only asks for it by URL, which is why it needs nothing passed
           * down through MainScreen to get here.
           */}
          <div className={cardClass}>
            <SettingsLegal
              onOpenPrivacy={() => openLegalDocument("privacy")}
              onOpenTerms={() => openLegalDocument("terms")}
              labels={{
                heading: t("settings.legal.heading"),
                description: t("settings.legal.description"),
                // The same two words the sign-in footer uses, kept as one
                // string: the `auth.` prefix records where the key was first
                // needed, not who owns the wording.
                privacy: t("auth.legal.privacy"),
                terms: t("auth.legal.terms"),
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
        </>
      )}

      {tab === "schedule" && (
        <div className={cardClass}>
          <SettingsSchedule
            initialView={initialView}
            onInitialViewChange={setInitialView}
            remindersEnabled={remindersEnabled}
            onRemindersEnabledChange={setRemindersEnabled}
            defaultLeadMinutes={defaultLeadMinutes}
            onDefaultLeadMinutesChange={setDefaultLeadMinutes}
            leadOptions={REMINDER_LEAD_CHOICES.map((n) => ({
              value: n,
              label: t("schedule.reminderLead", { n }),
            }))}
            labels={{
              heading: t("settings.schedule.heading"),
              description: t("settings.schedule.description"),
              initialViewLabel: t("settings.schedule.initialViewLabel"),
              day: t("settings.schedule.day"),
              week: t("settings.schedule.week"),
              month: t("settings.schedule.month"),
              hint: t("settings.schedule.hint"),
              reminderLabel: t("settings.schedule.reminderLabel"),
              reminderDescription: t("settings.schedule.reminderDescription"),
              reminderDefaultLabel: t("settings.schedule.reminderDefaultLabel"),
              reminderDefaultHint: t("settings.schedule.reminderDefaultHint"),
              reminderDesktopHint: t("settings.schedule.reminderDesktopHint"),
            }}
          />
        </div>
      )}

      {tab === TRASH_TAB_ID && (
        <>
          {/*
           * Heading in a card, list outside it: TrashView draws its own
           * bordered group cards, so wrapping the whole thing would put a
           * border inside a border.
           */}
          <div className={cardClass}>
            <div className="flex flex-col gap-1">
              <h3 className="flex items-center gap-2 text-base font-semibold text-lumen-text">
                <Trash2 size={16} className="text-lumen-text-secondary" />
                <span>{t("settings.trash.heading")}</span>
              </h3>
              <p className="text-sm text-lumen-text-secondary">
                {t("settings.trash.description")}
              </p>
            </div>
          </div>
          {trashService ? (
            <>
              <TrashScreen dataService={trashService} />
              {/*
               * Under the list, not above it: the sweep (#1438) is the rarer
               * errand of the two, and it is the one that cannot be undone.
               */}
              <AttachmentCleanupCard dataService={trashService} />
            </>
          ) : (
            <div className={cardClass}>
              <EmptyState
                icon={<Trash2 />}
                message={t("settings.trash.unavailable")}
              />
            </div>
          )}
        </>
      )}

      {tab !== "general" &&
        tab !== "schedule" &&
        tab !== TRASH_TAB_ID &&
        placeholder}

      <RightSidebarPortal>
        <SettingsTabsNav
          className="p-3"
          tabs={tabs}
          value={tab}
          onSelect={(id) => {
            if (id === TIPS_ROW_ID) {
              setTipsOpen(true);
              return;
            }
            setTab(id as SettingsTabId);
          }}
          label={t("settings.tabs.navLabel")}
        />
      </RightSidebarPortal>

      {/*
       * Tips, centred (#1174). The same panel the rightSidebar used to hold —
       * its live appearance preview reads the SAME `fontSize` / `themeMode`
       * the cards above write, so opening it after a change shows the change.
       */}
      <Modal
        open={tipsOpen}
        onClose={() => setTipsOpen(false)}
        title={t("settings.tabs.tips")}
        size="lg"
        padded={false}
      >
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
        <div className="flex justify-end px-5 pb-5">
          <Button variant="secondary" onClick={() => setTipsOpen(false)}>
            {t("common.close")}
          </Button>
        </div>
      </Modal>

      {/*
       * The tutorial launcher (#1194) — the overview + section picker the
       * Tutorial card now opens instead of restarting the tour outright.
       *
       * Both choices CLOSE IT FIRST. The tour draws a bubble over the section
       * it navigates to, and this dialog is a portal above everything: leaving
       * it up would put the tutorial behind its own launcher. Closing and
       * starting land in the same commit (React batches both setStates), so
       * the tour's anchor probe never runs against a screen the modal is
       * still covering.
       */}
      <TourLauncherModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        sections={tourSections}
        onSelectSection={(section) => {
          setTutorialOpen(false);
          startTourSection(section);
        }}
        onStartFull={() => {
          setTutorialOpen(false);
          restartTour();
        }}
        labels={{
          title: t("tour.launcher.title"),
          intro: t("tour.launcher.intro"),
          sectionsHeading: t("tour.launcher.sectionsHeading"),
          next: t("tour.launcher.next"),
          pickerTitle: t("tour.launcher.pickerTitle"),
          pickerIntro: t("tour.launcher.pickerIntro"),
          back: t("tour.launcher.back"),
          close: t("common.close"),
          full: t("tour.launcher.full"),
          fullDescription: t("tour.launcher.fullDescription"),
          comingSoon: t("tour.launcher.comingSoon"),
        }}
      />

      <DeleteAccountDialog
        open={deleteOpen}
        email={accountEmail}
        value={deleteInput}
        onValueChange={setDeleteInput}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
        busy={deleteBusy}
        error={deleteError}
        labels={{
          title: t("settings.account.delete.title"),
          body: t("settings.account.delete.body", { email: accountEmail }),
          consequences: deleteConsequences,
          typePrompt: t("settings.account.delete.typePrompt", {
            email: accountEmail,
          }),
          inputLabel: t("settings.account.delete.inputLabel"),
          confirm: t("settings.account.delete.confirm"),
          busyLabel: t("settings.account.delete.busy"),
          cancel: t("common.cancel"),
        }}
      />

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
