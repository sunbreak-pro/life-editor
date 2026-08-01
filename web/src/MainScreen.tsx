import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getDataService,
  signOut,
  AppShell,
  PageContainer,
  type PageContainerWidth,
  HeaderTabs,
  SegmentedControl,
  SectionHeader,
  RightSidebarProvider,
  RightSidebarToggle,
  CommandSearchField,
  useMediaQuery,
  isMac,
  isNativeMobile,
  CommandPalette,
  ToastProvider,
  SyncProvider,
  TaskTreeProvider,
  DailiesUnifiedProvider,
  NotesUnifiedProvider,
  RoutineProvider,
  ScheduleItemsProvider,
  CalendarProvider,
  WikiTagsUnifiedProvider,
  ShortcutConfigProvider,
  TimerProvider,
  AudioProvider,
  AudioChimeBridge,
  useTranslation,
  type BriefingTab,
  type AnalyticsTab,
  type SectionId,
  type Session,
} from "@life-editor/shared";
import { MaterialsCountsBridge } from "./MaterialsCountsBridge";
import { TrashScreen } from "./trash/TrashScreen";
import { DailyView } from "./daily/DailyView";
// NotesView pulls in the TipTap editor stack (core/react/starter-kit +
// extensions, ~hundreds of kB). Lazy-load it so that bundle stays out of
// the initial chunk and only downloads when the Notes tab is opened
// (L1 code-split — MainScreen already conditionally renders sections, so
// lazy + Suspense slots in cleanly). NotesView is a named export, so map
// it to the default the lazy() loader expects.
const NotesView = lazy(() =>
  import("./notes/NotesView").then((m) => ({ default: m.NotesView })),
);
import { BriefingScreen } from "./briefing/BriefingScreen";
import { ScheduleScreen, type ScheduleTab } from "./schedule/ScheduleScreen";
import { SettingsScreen } from "./settings/SettingsScreen";
import { WorkScreen } from "./work/WorkScreen";
import { AnalyticsScreen } from "./analytics/AnalyticsScreen";
import { ConnectScreen } from "./connect/ConnectScreen";
import { TagEditorHost } from "./tags/TagEditorHost";
import { GlobalShortcuts } from "./GlobalShortcuts";
import { UndoRedoHost } from "./UndoRedoHost";
import { HeaderUndoRedo } from "./HeaderUndoRedo";
import { MobileShellActions } from "./MobileShellActions";
import {
  useShellNavigation,
  type MaterialsTab,
} from "./hooks/useShellNavigation";
import { useShellChrome } from "./hooks/useShellChrome";
import { usePaletteItemSearch } from "./hooks/usePaletteItemSearch";

/*
 * Phase 2 S1+S2 host shell — target-IA wiring (App Shell).
 *
 * One DataService is created once and injected into every domain
 * Provider (the shared hooks never reach a module singleton —
 * CLAUDE.md §6.4). Provider order follows CLAUDE.md §6.2 (outer→inner):
 * Sync → TaskTree → … → Daily. Every domain reads `useSyncDomains` to know
 * when the data IT owns changed — since #499 a note edit does not refetch
 * the task tree, the tag graph, or the timer settings.
 *
 * S8: SyncProvider is now Supabase Realtime backed (one channel, all
 * tables). It is mounted ONCE at the top of MainScreen — wrapping the
 * whole shell, OUTSIDE the section switch — rather than per-section. A
 * per-section mount would tear down and reconnect the Realtime channel on
 * every section change (chatter + leak risk). Each section keeps its own
 * inner Provider nesting/order (§6.2); only SyncProvider moved up one
 * level, so every sync reader still sits inside it.
 *
 * Section routing is a local `useState` switch (no React Router — the
 * Tauri app uses `App.tsx::activeSection`, CLAUDE.md §3.2). The target IA
 * (IA.md 2026-07-05) collapses the old flat sections into 5 mainline + 2
 * utility, with the document surfaces (Notes / Daily) folded under a single
 * "Materials" section addressed by an in-section tab (`materialsTab`). Todos
 * left that group in #411 and are now Schedule's second tab (`scheduleTab`),
 * next to the calendar they get scheduled onto. This host only wires the
 * shell — the section bodies + their Provider nesting are unchanged.
 */

/*
 * Section identity, order, icons, and the desktop/mobile nav views all come
 * from the shared section registry (SSOT — shared/src/sections.ts), derived
 * inside useShellChrome rather than hand-maintained here. The old REPL
 * section is retired (§8) and never appears in the registry.
 */

/*
 * v2 keeps the NARROW layout untouched (non-goal: mobile unchanged): the
 * in-body hamburger row appears only where it did pre-v2. Schedule and
 * Materials own their narrow chrome; Analytics / Trash had no row (they had
 * no panel before v2 — their new placeholder panel is Desktop-header-only
 * for now).
 */
const MOBILE_HAMBURGER_SECTIONS: ReadonlySet<SectionId> = new Set([
  "connect",
  "work",
  "settings",
]);

/*
 * Mobile 省略 Provider gate (#320 — CLAUDE.md §2). The SAME web bundle ships
 * to browser / Electron / Capacitor, so the omission is a runtime decision:
 * on the native mobile shells (`isNativeMobile()` — window.Capacitor present)
 * this host renders children WITHOUT the Provider. Consumers stay safe
 * because the context exposes an OPTIONAL hook (useShortcutConfig → null
 * outside a Provider, coding-principles §4): the shortcut executor goes
 * inert and Settings hides the Shortcuts card. `isNativeMobile()` reads a
 * runtime global that never changes within a page load, so evaluating it
 * during render is stable (no reactivity needed).
 *
 * AudioProvider is deliberately NOT gated: the Pomodoro completion chime is
 * part of the Mobile-Full work timer (mobile-scope.md #10/#11 — user-confirmed
 * #319), so the Provider stays mounted everywhere and only the ambient-mixer
 * UI is native-omitted, inside WorkScreen.
 */
function ShortcutConfigHost({ children }: { children: ReactNode }) {
  if (isNativeMobile()) return <>{children}</>;
  return <ShortcutConfigProvider>{children}</ShortcutConfigProvider>;
}

export function MainScreen({ session }: { session: Session }) {
  const { t } = useTranslation();
  const ds = useMemo(() => getDataService(), []);
  // Navigation half (hooks split — useShellNavigation): the section switch
  // (§3.2), the lifted in-section tab states, and the pending-intent stashes
  // (new-task flag / "[[" item-nav) the destination views consume on mount.
  const {
    section,
    setSection,
    materialsTab,
    setMaterialsTab,
    scheduleTab,
    setScheduleTab,
    analyticsTab,
    setAnalyticsTab,
    briefingTab,
    setBriefingTab,
    pendingNewTask,
    consumeNewTask,
    handleNavigate,
    handleNewTask,
    navigateToItem,
    consumeItemNav,
    pendingNoteSelect,
    pendingDailySelect,
    pendingTaskSelect,
    pendingEventSelect,
  } = useShellNavigation();
  // Chrome half (hooks split — useShellChrome): the palette commands, the
  // registry-derived nav section lists, the per-section tab-band defs, the
  // translated shell labels, and the Materials count badges the headless
  // MaterialsCountsBridge feeds via setMaterialsCounts.
  const {
    setMaterialsCounts,
    commands,
    navSections,
    utilitySections,
    mobileSections,
    materialsTabDefs,
    scheduleTabDefs,
    analyticsTabDefs,
    briefingTabDefs,
    shellLabels,
  } = useShellChrome({ setSection, setMaterialsTab, setScheduleTab });
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Cross-item search half of the palette (#503) — makes the header field's
  // "search or run a command" promise true. It reads nothing until a non-empty
  // query is typed, so opening the palette to jump sections still costs zero
  // queries (#430's lazy rule).
  const { results: paletteItemResults, handleQueryChange: onPaletteQuery } =
    usePaletteItemSearch({
      dataService: ds,
      isOpen: paletteOpen,
      onOpenItem: navigateToItem,
    });
  // Global tag editor (#409). Opened from the sidebar footer row above ⌘K, so
  // the tag master is reachable from every section — the panel itself is
  // mount-on-open (TagEditorHost) and fetches nothing while closed.
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  // Narrow-width switch for the Materials tab control (HeaderTabs ↔ Segmented).
  // Independent of AppShell's own wide/narrow switch (same query, own read).
  const isWide = useMediaQuery("(min-width: 768px)", true);

  // W3-C completion-chime ref-bridge. TimerProvider sits OUTSIDE AudioProvider
  // (§6.2 … → Timer → Audio → …), so the Timer's onSessionComplete can't read
  // useAudioContext directly. The AudioChimeBridge (mounted inside the
  // AudioProvider) publishes the live playCompletionChime into this ref; the
  // Timer fires it through the ref on each phase completion.
  const chimeRef = useRef<(() => void) | null>(null);

  // Content width (Issue #305 — every section/tab is unified to a centered
  // ~1120px column, max-w-lumen-wide). The only thing that varies now is the
  // SCROLL OWNERSHIP, so PageContainer still gets two variants (both clamped to
  // max-w-lumen-wide, see PageContainer.tsx):
  //   - "fluid": canvas/board surfaces that own their full-bleed h-full layout
  //     + self-scroll inside the clamped box (Connect graph, both Schedule tabs
  //     — calendar grid and the Kanban that moved here in #411 — plus Analytics
  //     whose shared view draws its own centered data column). Their internal
  //     horizontal scroll (kanban board / week grid) stays inside the 1120px
  //     column — no page-level scroll.
  //   - "wide": every document surface — PageContainer owns the vertical scroll
  //     wrapper (Notes / Daily / Briefing / Work / Settings / Trash).
  // Mobile is visually unchanged: below 768px the max-w clamp never engages, so
  // both variants render gutter-padded full width.
  const ownsFullBleed =
    section === "connect" || section === "schedule" || section === "analytics";
  const pageWidth: PageContainerWidth = ownsFullBleed ? "fluid" : "wide";

  // Detail-panel (rightSidebar) toggle, injected already-translated (§6.4).
  // Desktop = PanelRight at the header-tab row's right end; Mobile = a bordered
  // hamburger at the left of the segment row that opens the left drawer. The
  // toggle flips its own aria-label between the two (open ↔ close action).
  const detailOpenLabel = t("detailPanel.open");
  const detailCloseLabel = t("detailPanel.close");

  // Standard header controls (v2 §1). Left→right: the command-palette search
  // field (#306), app-level Undo/Redo (#304), then the rightSidebar toggle:
  // [search][Undo][Redo][rightSidebar]. The rightSidebar toggle is
  // UNCONDITIONAL for all 7 sections (v2 §3); the v2 §5 width tab was retired
  // 2026-07-11 (all sections wide).
  const headerControls = (
    <>
      <CommandSearchField
        onOpen={() => setPaletteOpen(true)}
        placeholder={t("commandPalette.trigger")}
        label={t("nav.commandPalette")}
        shortcutHint={isMac ? "⌘K" : "Ctrl K"}
      />
      <HeaderUndoRedo />
      <RightSidebarToggle
        variant="panel"
        openLabel={detailOpenLabel}
        closeLabel={detailCloseLabel}
      />
    </>
  );

  // Standard section header row (v2 §1), mounted in AppShell's header slot —
  // ABOVE the main + detail-panel flex row (§4), so the divider spans both
  // and the controls never move when the panel opens. Materials', Schedule's,
  // and Analytics' tab bands double as their titles (divider={false}: the
  // SectionHeader owns the line); every other section shows its translated
  // title. Sections that still draw their own in-body chrome (Connect internal
  // header) migrate to this row in their v2 adoption pass (orders plans).
  const sectionHeader =
    section === "materials" ? (
      <SectionHeader
        tabs={
          <HeaderTabs
            divider={false}
            tabs={materialsTabDefs}
            activeTab={materialsTab}
            onSelect={(id) => setMaterialsTab(id as MaterialsTab)}
            label={t("section.materials")}
          />
        }
        controls={headerControls}
      />
    ) : section === "analytics" ? (
      <SectionHeader
        tabs={
          <HeaderTabs
            divider={false}
            tabs={analyticsTabDefs}
            activeTab={analyticsTab}
            onSelect={(id) => setAnalyticsTab(id as AnalyticsTab)}
            label={t("analytics.tabsLabel")}
          />
        }
        controls={headerControls}
      />
    ) : section === "briefing" ? (
      <SectionHeader
        tabs={
          <HeaderTabs
            divider={false}
            tabs={briefingTabDefs}
            activeTab={briefingTab}
            onSelect={(id) => setBriefingTab(id as BriefingTab)}
            label={t("briefing.tabsLabel")}
          />
        }
        controls={headerControls}
      />
    ) : section === "schedule" ? (
      <SectionHeader
        tabs={
          <HeaderTabs
            divider={false}
            tabs={scheduleTabDefs}
            activeTab={scheduleTab}
            onSelect={(id) => setScheduleTab(id as ScheduleTab)}
            label={t("section.schedule")}
          />
        }
        controls={headerControls}
      />
    ) : (
      <SectionHeader
        title={t(`section.${section}`, { defaultValue: section })}
        controls={headerControls}
      />
    );

  // NARROW layout rows — unchanged from v1 (v2 non-goal: mobile untouched).
  // Materials keeps its hamburger + segmented tab row; Connect / Work /
  // Settings keep their hamburger row (MOBILE_HAMBURGER_SECTIONS).
  const materialsMobileSwitcher = (
    <div className="flex items-center gap-2">
      <RightSidebarToggle
        variant="hamburger"
        openLabel={detailOpenLabel}
        closeLabel={detailCloseLabel}
      />
      <SegmentedControl
        className="flex-1"
        options={materialsTabDefs}
        value={materialsTab}
        onChange={(id) => setMaterialsTab(id as MaterialsTab)}
        label={t("section.materials")}
      />
    </div>
  );

  // Schedule's narrow Calendar/Todo switcher (#411). No hamburger beside it,
  // unlike Materials': the Calendar body draws its own (next to the period
  // label), and the Todo body closes the drawer outright below 768px — the
  // mobile Kanban carries its task detail in its own bottom sheet (#470), not in
  // the drawer — so a second hamburger here would either duplicate one or open
  // an empty drawer.
  const scheduleMobileSwitcher = (
    <SegmentedControl
      options={scheduleTabDefs}
      value={scheduleTab}
      onChange={(id) => setScheduleTab(id as ScheduleTab)}
      label={t("section.schedule")}
    />
  );

  // Briefing's narrow-width 朝刊/夕刊 switcher (#318). AppShell renders its
  // header slot on the WIDE branch only, so below 768px the SectionHeader band
  // — the sole route to 夕刊 — is gone. Briefing's body is a centered "paper"
  // rather than a list, so unlike Materials the band is re-issued INSIDE the
  // view (under the masthead) instead of in a PageContainer toolbar row.
  const briefingMobileSwitcher = isWide ? undefined : (
    <SegmentedControl
      options={briefingTabDefs}
      value={briefingTab}
      onChange={(id) => setBriefingTab(id as BriefingTab)}
      label={t("briefing.tabsLabel")}
    />
  );

  const sectionToolbar =
    !isWide && MOBILE_HAMBURGER_SECTIONS.has(section) ? (
      <div className="flex items-center">
        <RightSidebarToggle
          variant="hamburger"
          openLabel={detailOpenLabel}
          closeLabel={detailCloseLabel}
        />
      </div>
    ) : null;

  const detailPanelLabels = {
    title: t("detailPanel.title"),
    close: t("detailPanel.close"),
    empty: t("detailPanel.empty"),
    resize: t("detailPanel.resize"),
  };

  // The Materials document surfaces. Provider nesting is verbatim from
  // the old flat sections (§6.2) — only the addressing changed (section+tab).
  const materialsView = (
    <>
      {materialsTab === "notes" && (
        <WikiTagsUnifiedProvider dataService={ds}>
          <NotesUnifiedProvider dataService={ds}>
            <Suspense
              fallback={
                <p className="text-lumen-text-secondary">Loading notes…</p>
              }
            >
              <NotesView
                dataService={ds}
                onNavigateToItem={navigateToItem}
                pendingSelectNoteId={pendingNoteSelect}
                onConsumePendingSelect={consumeItemNav}
              />
            </Suspense>
          </NotesUnifiedProvider>
        </WikiTagsUnifiedProvider>
      )}
      {materialsTab === "daily" && (
        <WikiTagsUnifiedProvider dataService={ds}>
          <DailiesUnifiedProvider dataService={ds}>
            <DailyView
              dataService={ds}
              onNavigateToItem={navigateToItem}
              pendingSelectDate={pendingDailySelect}
              onConsumePendingSelect={consumeItemNav}
            />
          </DailiesUnifiedProvider>
        </WikiTagsUnifiedProvider>
      )}
    </>
  );

  // The six non-Materials section bodies. Provider nesting is verbatim from the
  // flat layout (§6.2) — only wrapped below with a detail-panel toolbar row.
  const nonMaterialsBody = (
    <>
      {/*
       * Briefing (Briefing plan Step 1) — the morning-paper home surface and
       * the default landing section (useStartupSection). Crosses four domains
       * (schedule / tasks / timer / dailies) read-only, so it uses no
       * per-section Provider — BriefingScreen calls the injected DataService
       * directly (same pattern as TrashScreen) and re-fetches on Realtime
       * syncVersion bumps, which is how a briefing written by Claude via MCP
       * appears without a reload.
       */}
      {section === "briefing" && (
        <BriefingScreen
          dataService={ds}
          onNavigate={handleNavigate}
          tab={briefingTab}
          tabSwitcher={briefingMobileSwitcher}
        />
      )}
      {/*
       * Schedule pair order (CLAUDE.md §6.2): Routine → ScheduleItems. Each
       * inner Provider may read the outer one (ScheduleItems sits INSIDE
       * Routine). CalendarProvider is NOT part of the pair — kept higher and
       * enabled on Mobile (§2). The Routine→schedule_items generator (S4-5) is
       * the headless RoutineScheduleSync, mounted inside the Providers.
       *
       * WikiTagsUnifiedProvider provides both the Event Tag/Link surface for
       * ScheduleItemsView (DU-F Step 7) and the life-tag <select> for
       * CalendarView (life-tags S2: calendars.tag_id FKs wiki_tags(id) ON
       * DELETE CASCADE — the folder-scoped view is now a tag-scoped view, so
       * TaskTreeProvider is no longer needed on this branch).
       */}
      {section === "schedule" && (
        // TaskTreeProvider is OUTERMOST here (schedule redesign A-1): the
        // Calendar reads scheduled TaskNodes to render task=blue chips. Provider
        // order (§6.2) places TaskTree before Calendar, and TaskTree depends on
        // neither WikiTags nor Calendar, so it sits at the very outside.
        // #411 folded the Kanban in as the Todo tab. It needs the same two
        // Providers it had in Materials (TaskTree + WikiTags) and both are
        // already on this branch, so the tab reuses them rather than nesting a
        // second pair — one task store for the calendar chips, the Todo tray
        // and the board. `persistSelection` moved with the board: it is what
        // re-opens the task the user was reading after a tab switch (#282).
        <TaskTreeProvider dataService={ds} persistSelection>
          <WikiTagsUnifiedProvider dataService={ds}>
            <CalendarProvider dataService={ds}>
              <RoutineProvider dataService={ds}>
                <ScheduleItemsProvider dataService={ds}>
                  <ScheduleScreen
                    dataService={ds}
                    tab={scheduleTab}
                    onOpenTasks={() => setScheduleTab("todo")}
                    pendingNewTask={pendingNewTask}
                    onConsumeNewTask={consumeNewTask}
                    pendingSelectTaskId={pendingTaskSelect}
                    onConsumePendingSelect={consumeItemNav}
                    pendingSelectEvent={pendingEventSelect}
                    onConsumePendingEvent={consumeItemNav}
                  />
                </ScheduleItemsProvider>
              </RoutineProvider>
            </CalendarProvider>
          </WikiTagsUnifiedProvider>
        </TaskTreeProvider>
      )}
      {/*
       * Settings (W1) — reads useThemeContext + useShortcutConfig (the
       * ShortcutConfigProvider wrapping the whole shell) and injects values +
       * t() copy into the shared pure primitives. No extra Provider needed.
       */}
      {section === "settings" && <SettingsScreen />}
      {/*
       * Work (W3-B) — Pomodoro timer + TaskSelector + settings/preset editor.
       * TimerProvider is mounted at the shell level (above); this view reads
       * useTimerContext + fetches the task list via the injected DataService.
       */}
      {section === "work" && <WorkScreen dataService={ds} />}
      {/*
       * Connect (W4; STEP 2 link editing) — node graph + backlink over the
       * UNIFIED item-link model. ConnectScreen mounts its own
       * WikiTagsUnifiedProvider internally. Legacy note_links are NOT used.
       */}
      {section === "connect" && <ConnectScreen dataService={ds} />}
      {/*
       * Analytics (W4) — recharts dashboards (Overview/Tasks/Work/Schedule).
       * Host fetches sessions/tasks/schedule/routines via DataService and
       * injects data + t into the pure shared <AnalyticsView>.
       */}
      {section === "analytics" && (
        <AnalyticsScreen
          dataService={ds}
          tab={analyticsTab}
          onTabChange={setAnalyticsTab}
        />
      )}
      {/*
       * Trash (W2). Crosses all five soft-delete categories, so it uses no
       * per-section Provider — TrashScreen calls the injected DataService
       * directly and feeds the pure shared TrashView (§6.4).
       */}
      {section === "trash" && <TrashScreen dataService={ds} />}
    </>
  );

  return (
    /*
     * ToastProvider (follow-up #6) — host mount for the shared toast stack.
     * Per CLAUDE.md §6.2 Toast sits between Theme (main.tsx) and Sync, OUTSIDE
     * the section switch, so any section (currently Connect's link-edit
     * failures) can raise a toast via useToast(). dismissLabel is injected
     * already-translated (§6.4); the card copy itself is host-resolved too.
     */
    <ToastProvider dismissLabel={t("common.close")}>
      <SyncProvider>
        {/*
         * Materials tab count badges (target IA). Headless — sits inside
         * SyncProvider so it can refetch the four Materials lists on every
         * Realtime `syncVersion` bump, then reports the derived counts up to
         * the shell (materialsTabDefs badges). DataService is injected (§6.4).
         */}
        <MaterialsCountsBridge dataService={ds} onCounts={setMaterialsCounts} />
        {/*
         * UndoRedoHost (#304) — mounts the app-wide UndoRedo provider just
         * inside Sync (§6.2 Sync → UndoRedo), wrapping the shortcut executor,
         * the domain providers (which auto-connect via useUndoRedoOptional), and
         * the shell (whose header hosts the Undo/Redo buttons). Raises a toast
         * of what was undone/redone.
         */}
        <UndoRedoHost>
          {/*
           * ShortcutConfigProvider (W1) is a Mobile 省略 Provider (CLAUDE.md §2):
           * the host gate above (#320) mounts it on browser / Electron and skips
           * it on the native Capacitor shells. Per §6.2 Theme is outer (it lives
           * in main.tsx); Shortcut sits inner — here just inside Sync and OUTSIDE
           * the section switch, so the (currently settings-only) consumer reads a
           * stable Provider regardless of the active section.
           */}
          <ShortcutConfigHost>
            {/*
             * Global shortcut executor (W3-0/W3-B). Headless — sits inside the
             * ShortcutConfigProvider (MainScreen's own body can't read
             * useShortcutConfig) and wires keydown to section nav + palette toggle.
             * Reads the live (rebindable) config, so Settings rebinds apply at
             * once. nav:* + new-task route through the target-IA mapping
             * (handleNavigate / handleNewTask → Materials + tab + create dialog).
             * undo / redo route through the ambient global UndoRedo context
             * inside GlobalShortcuts itself (#304 / PR #316).
             */}
            <GlobalShortcuts
              onNavigate={handleNavigate}
              onOpenSettings={() => setSection("settings")}
              onTogglePalette={() => setPaletteOpen((v) => !v)}
              onNewTask={handleNewTask}
            />
            {/*
             * TimerProvider (W3-B) — REQUIRED Provider (Timer is enabled on Mobile,
             * NOT a §2 省略 Provider). Mounted ONCE at the shell level (inside Sync,
             * which it reads; §6.2 places it after the Schedule trio and OUTSIDE the
             * section switch) so the Pomodoro keeps running while the user navigates
             * away from the Work tab. The future W3-C AudioProvider nests INSIDE
             * this (§6.2: … → Timer → Audio → …), which is why TimerProvider is the
             * inner-most shell Provider here. DataService is injected (§6.4).
             */}
            <TimerProvider
              dataService={ds}
              onSessionComplete={() => chimeRef.current?.()}
            >
              {/*
               * AudioProvider (W3-C) — mounted on EVERY host, native shells
               * included (#320): the completion chime it powers is part of the
               * Mobile-Full work timer (mobile-scope.md #10/#11), so only the
               * ambient-mixer UI is native-omitted (WorkScreen), not the
               * Provider. Nested INSIDE TimerProvider (§6.2 … → Timer → Audio
               * → …). The headless AudioChimeBridge sits inside it and pipes
               * the live playCompletionChime up to chimeRef so the Timer's
               * onSessionComplete (declared on the outer Provider) can ring it.
               */}
              <AudioProvider dataService={ds}>
                <AudioChimeBridge targetRef={chimeRef} />
                {/*
                 * RightSidebarProvider (App Shell Turn 2) — host mount for the
                 * target-IA detail panel. Sits OUTSIDE the section switch (like
                 * ToastProvider), wrapping the shell + CommandPalette so the panel
                 * survives navigation and every section body can portal into it.
                 * Pure UI state (DataService-free, §3.1).
                 */}
                <RightSidebarProvider>
                  {/*
                   * W5 app shell — responsive single shell (wide sidebar ↔ narrow
                   * bottom tabs via useMediaQuery). Section state stays here
                   * (useState switch, no React Router — §3.2); the shell is pure
                   * presentation (DataService-free, §3.1) and receives section
                   * list / labels / callbacks as props (§6.4). detailPanelLabels
                   * mounts the Turn 2 push-in panel (Desktop) / left drawer
                   * (Mobile) — valid because we wrap in RightSidebarProvider above.
                   */}
                  <AppShell
                    sections={navSections}
                    utilitySections={utilitySections}
                    mobileSections={mobileSections}
                    activeSection={section}
                    onNavigate={(id) => setSection(id as SectionId)}
                    onTogglePalette={() => setPaletteOpen((v) => !v)}
                    onOpenTagEditor={() => setTagEditorOpen(true)}
                    userEmail={session.user.email ?? ""}
                    onSignOut={() => void signOut()}
                    labels={shellLabels}
                    detailPanelLabels={detailPanelLabels}
                    header={sectionHeader}
                    /*
                     * Narrow-only counterpart to `header` (#472). `header` is a
                     * wide-branch slot, so undo/redo and the command palette
                     * (#473) would otherwise be unreachable on mobile; AppShell
                     * hands these to the bottom bar's "More" sheet. A callback
                     * (not a node) because the rows read UndoRedoContext, and
                     * MainScreen's own body sits OUTSIDE the <UndoRedoHost> it
                     * mounts.
                     */
                    bottomBarActions={(closeSheet) => (
                      <MobileShellActions
                        onOpenPalette={() => setPaletteOpen(true)}
                        closeSheet={closeSheet}
                      />
                    )}
                  >
                    {/*
                     * PageContainer (Layout Standard v1 #180 / v2) owns width +
                     * gutter + scroll for every section. On the WIDE layout the
                     * section chrome now lives in AppShell's header slot (the
                     * standard SectionHeader above), so the header slot here only
                     * carries the NARROW-layout rows: Materials' hamburger +
                     * segmented tab row, Schedule's Calendar/Todo segmented row
                     * (#411 — the one narrow row v1 didn't have, since the tab
                     * itself is new), and the Connect / Work / Settings
                     * hamburger row.
                     */}
                    {section === "materials" ? (
                      <PageContainer
                        width={pageWidth}
                        header={isWide ? undefined : materialsMobileSwitcher}
                      >
                        {materialsView}
                      </PageContainer>
                    ) : (
                      <PageContainer
                        width={pageWidth}
                        header={
                          !isWide && section === "schedule"
                            ? scheduleMobileSwitcher
                            : (sectionToolbar ?? undefined)
                        }
                      >
                        {nonMaterialsBody}
                      </PageContainer>
                    )}
                  </AppShell>

                  {/*
                   * Command palette mounted ONCE at the shell level, outside the
                   * section switch (so Cmd+K works from any section). Copy is
                   * injected as props — the primitive never calls useTranslation.
                   */}
                  <CommandPalette
                    isOpen={paletteOpen}
                    onClose={() => setPaletteOpen(false)}
                    commands={commands}
                    placeholder={t("commandPalette.placeholder")}
                    noResultsLabel={t("commandPalette.noResults")}
                    externalResults={paletteItemResults}
                    onQueryChange={onPaletteQuery}
                  />

                  {/*
                   * Global tag editor (#409), mounted beside the palette at the
                   * shell level so it opens over any section. It owns its own
                   * tag hook instance rather than a WikiTagsUnifiedProvider —
                   * that Provider is section-layer and absent on Briefing /
                   * Work / Analytics / Settings / Trash (see TagEditorHost).
                   */}
                  <TagEditorHost
                    open={tagEditorOpen}
                    onClose={() => setTagEditorOpen(false)}
                    dataService={ds}
                  />
                </RightSidebarProvider>
              </AudioProvider>
            </TimerProvider>
          </ShortcutConfigHost>
        </UndoRedoHost>
      </SyncProvider>
    </ToastProvider>
  );
}
