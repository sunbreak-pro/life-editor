import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckSquare,
  CalendarDays,
  FileText,
  Tag,
  type LucideIcon,
} from "lucide-react";
import {
  getDataService,
  signOut,
  AppShell,
  type AppShellSection,
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
  SECTIONS,
  MAIN_SECTIONS,
  UTILITY_SECTIONS,
  MOBILE_SECTIONS,
  resolveInitialSection,
  persistLastSection,
  EMPTY_MATERIALS_COUNTS,
  ANALYTICS_TAB_ORDER,
  defaultBriefingTab,
  type BriefingTab,
  type MaterialsCounts,
  type AnalyticsTab,
  type SectionId,
  type SectionDef,
  type Command,
  type NavSection,
  type Session,
} from "@life-editor/shared";
import { MaterialsCountsBridge } from "./MaterialsCountsBridge";
import { TrashScreen } from "./trash/TrashScreen";
import { KanbanView } from "./tasks/KanbanView";
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
import { WikiTagsManagementView } from "./wikitag";
import { SettingsScreen } from "./settings/SettingsScreen";
import { WorkScreen } from "./work/WorkScreen";
import { AnalyticsScreen } from "./analytics/AnalyticsScreen";
import { ConnectScreen } from "./connect/ConnectScreen";
import { GlobalShortcuts } from "./GlobalShortcuts";

/*
 * Phase 2 S1+S2 host shell — target-IA wiring (App Shell).
 *
 * One DataService is created once and injected into every domain
 * Provider (the shared hooks never reach a module singleton —
 * CLAUDE.md §6.4). Provider order follows CLAUDE.md §6.2 (outer→inner):
 * Sync → TaskTree → … → Daily. Every domain reads `useSyncContext` to
 * know when to refetch.
 *
 * S8: SyncProvider is now Supabase Realtime backed (one channel, all
 * tables). It is mounted ONCE at the top of MainScreen — wrapping the
 * whole shell, OUTSIDE the section switch — rather than per-section. A
 * per-section mount would tear down and reconnect the Realtime channel on
 * every section change (chatter + leak risk). Each section keeps its own
 * inner Provider nesting/order (§6.2); only SyncProvider moved up one
 * level, so every `useSyncContext` reader still sits inside it.
 *
 * Section routing is a local `useState` switch (no React Router — the
 * Tauri app uses `App.tsx::activeSection`, CLAUDE.md §3.2). The target IA
 * (IA.md 2026-07-05) collapses the old flat sections into 5 mainline + 2
 * utility, with the four document surfaces (Tasks / Notes / Daily / Tags)
 * folded under a single "Materials" section addressed by an in-section tab
 * (`materialsTab`). This host only wires the shell — the section bodies +
 * their Provider nesting are unchanged from the flat layout.
 */

/*
 * Section identity, order, icons, and the desktop/mobile nav views all come
 * from the shared section registry (SSOT — shared/src/sections.ts). This host
 * derives its nav from SECTIONS / MAIN_SECTIONS / UTILITY_SECTIONS /
 * MOBILE_SECTIONS instead of hand-maintaining parallel literal lists.
 * The old REPL section is retired (§8) and never appears in the registry.
 */

/** In-Materials tab — the four document surfaces addressed by one section. */
type MaterialsTab = "tasks" | "notes" | "daily" | "tags";

const MATERIALS_TABS: readonly MaterialsTab[] = [
  "tasks",
  "notes",
  "daily",
  "tags",
];

const MATERIALS_ICON: Record<MaterialsTab, LucideIcon> = {
  tasks: CheckSquare,
  notes: FileText,
  daily: CalendarDays,
  tags: Tag,
};

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

export function MainScreen({ session }: { session: Session }) {
  const { t } = useTranslation();
  const ds = useMemo(() => getDataService(), []);
  // Startup section (§216): resolve the initial section from the user's
  // preference (resume last-visited / a fixed section), falling back to the
  // default. Lazy init so the localStorage read runs once.
  const [section, setSection] = useState<SectionId>(() =>
    resolveInitialSection(),
  );
  const [materialsTab, setMaterialsTab] = useState<MaterialsTab>("tasks");
  // Schedule's Calendar / Routines tab, lifted here (v2 adoption #204) so the
  // standard SectionHeader can render the band — same pattern as materialsTab.
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("calendar");
  // Analytics's Overview/Tasks/Work/Schedule tab, lifted here (v2 adoption
  // #208) so the standard SectionHeader renders the band — same tabs-as-title
  // pattern as materialsTab / scheduleTab.
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("overview");
  // Briefing's 朝刊/夕刊 tab (#263 F-6), lifted here so the standard
  // SectionHeader renders the band — same tabs-as-title pattern as
  // materialsTab / scheduleTab. Lazy init: the initial tab follows the clock
  // (evening from 17:00, honoring the day-start pref's post-midnight tail).
  const [briefingTab, setBriefingTab] = useState<BriefingTab>(() =>
    defaultBriefingTab(),
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  // global:new-task intent, consumed once by the Kanban when it mounts (see
  // handleNewTask). A boolean "pending" flag — not a nonce — so returning to
  // the Tasks tab later never re-opens the add dialog.
  const [pendingNewTask, setPendingNewTask] = useState(false);
  // Materials tab count badges, fed by the headless MaterialsCountsBridge
  // (mounted inside SyncProvider so it can refetch on Realtime changes).
  const [materialsCounts, setMaterialsCounts] = useState<MaterialsCounts>(
    EMPTY_MATERIALS_COUNTS,
  );
  // Narrow-width switch for the Materials tab control (HeaderTabs ↔ Segmented).
  // Independent of AppShell's own wide/narrow switch (same query, own read).
  const isWide = useMediaQuery("(min-width: 768px)", true);

  // Startup section (§216): remember the last-visited section so the "resume"
  // startup preference can restore it on the next launch. Writes on every
  // section change (localStorage only — no re-render).
  useEffect(() => {
    persistLastSection(section);
  }, [section]);

  // W3-C completion-chime ref-bridge. TimerProvider sits OUTSIDE AudioProvider
  // (§6.2 … → Timer → Audio → …), so the Timer's onSessionComplete can't read
  // useAudioContext directly. The AudioChimeBridge (mounted inside the
  // AudioProvider) publishes the live playCompletionChime into this ref; the
  // Timer fires it through the ref on each phase completion.
  const chimeRef = useRef<(() => void) | null>(null);

  // Map the shared nav:* shortcuts (tasks/daily/notes/schedule/tags) onto the
  // target IA: schedule is its own section; the document surfaces route to the
  // Materials section + the matching tab.
  const handleNavigate = useCallback((nav: NavSection) => {
    if (nav === "schedule") {
      setSection("schedule");
      return;
    }
    setSection("materials");
    setMaterialsTab(nav);
  }, []);

  // Briefing rows deep-link into Schedule / Tasks. Force the Schedule calendar
  // tab first so a "promise" jump doesn't land on the routines tab (where the
  // schedule item isn't shown).
  const handleBriefingNavigate = useCallback(
    (nav: NavSection) => {
      if (nav === "schedule") setScheduleTab("calendar");
      handleNavigate(nav);
    },
    [handleNavigate],
  );

  // global:new-task executor. Task creation lives inside the Kanban (mounted
  // per-tab behind its own Provider), so the shell can't call the create API
  // directly. Instead it navigates to Materials → Tasks and raises a "pending
  // new task" flag; the Kanban consumes it on mount and opens its add dialog
  // (which auto-focuses the title input and creates the task on submit via the
  // TaskTree provider). That is the app's own create-and-focus entry — no new
  // DataService API, no title-less junk rows.
  const handleNewTask = useCallback(() => {
    setSection("materials");
    setMaterialsTab("tasks");
    setPendingNewTask(true);
  }, []);
  // Kanban calls this once it has acted on the pending-new-task flag.
  const consumeNewTask = useCallback(() => setPendingNewTask(false), []);

  // "[[" wiki-link navigation (Issue #285). A resolved link click in the Notes
  // or Daily editor routes here; MainScreen owns the section + Materials-tab
  // switch (the target view lives behind a different domain Provider), then
  // stashes a pending selection the destination view consumes on mount — the
  // same idiom as pendingNewTask. v1 handles note / daily targets; other roles
  // (tasks) have no cross-section item selection yet, so they no-op.
  const [pendingItemNav, setPendingItemNav] = useState<{
    id: string;
    role: string;
  } | null>(null);
  const navigateToItem = useCallback((target: { id: string; role: string }) => {
    if (target.role === "note" || target.role === "daily") {
      setSection("materials");
      setMaterialsTab(target.role === "note" ? "notes" : "daily");
      setPendingItemNav(target);
    }
  }, []);
  const consumeItemNav = useCallback(() => setPendingItemNav(null), []);
  const pendingNoteSelect =
    pendingItemNav?.role === "note" ? pendingItemNav.id : null;
  const pendingDailySelect =
    pendingItemNav?.role === "daily"
      ? pendingItemNav.id.replace(/^daily-/, "")
      : null;

  const commands = useMemo<Command[]>(() => {
    const goTo = t("commandPalette.goTo", { defaultValue: "Go to" });
    const sectionCmds = SECTIONS.map<Command>((s) => ({
      id: `section-${s.id}`,
      title: t(s.labelKey, { defaultValue: s.id }),
      category: goTo,
      icon: s.icon,
      action: () => setSection(s.id),
    }));
    const materialsCmds = MATERIALS_TABS.map<Command>((tab) => ({
      id: `materials-${tab}`,
      title: t(`section.${tab}`, { defaultValue: tab }),
      category: goTo,
      icon: MATERIALS_ICON[tab],
      action: () => {
        setSection("materials");
        setMaterialsTab(tab);
      },
    }));
    return [...sectionCmds, ...materialsCmds];
  }, [t]);

  // W5 app shell: section lists (icon node + translated label). i18n is
  // resolved here and injected — the shared shell never calls useTranslation
  // (§6.4). Mainline vs utility vs mobile order are three views of the same
  // sections keyed by Section id.
  const toSections = useCallback(
    (defs: readonly SectionDef[]): AppShellSection[] =>
      defs.map((s) => {
        const Icon = s.icon;
        return {
          id: s.id,
          label: t(s.labelKey, { defaultValue: s.id }),
          icon: <Icon size={18} />,
        };
      }),
    [t],
  );
  const navSections = useMemo(() => toSections(MAIN_SECTIONS), [toSections]);
  const utilitySections = useMemo(
    () => toSections(UTILITY_SECTIONS),
    [toSections],
  );
  const mobileSections = useMemo(
    () => toSections(MOBILE_SECTIONS),
    [toSections],
  );

  // Materials in-section tab defs (Tasks / Notes / Daily / Tags). Each tab
  // shows a count badge (Tasks = unfinished count; the rest = live item count)
  // fed by the MaterialsCountsBridge. A zero count leaves the badge unset so
  // empty surfaces don't render a noisy "0" pill.
  const materialsTabDefs = useMemo(
    () =>
      MATERIALS_TABS.map((id) => {
        const count = materialsCounts[id];
        return {
          id,
          label: t(`section.${id}`, { defaultValue: id }),
          badge: count > 0 ? count : undefined,
        };
      }),
    [t, materialsCounts],
  );

  // Analytics in-section tab defs (Overview / Tasks / Work / Schedule). No
  // count badges — these tabs are views, not item lists. Order comes from the
  // shared ANALYTICS_TAB_ORDER (SSOT) so the shell band and AnalyticsView's
  // content never drift.
  const analyticsTabDefs = useMemo(
    () =>
      ANALYTICS_TAB_ORDER.map((id) => ({
        id,
        label: t(`analytics.tabs.${id}`, { defaultValue: id }),
      })),
    [t],
  );

  const shellLabels = useMemo(
    () => ({
      appName: "Life Editor",
      collapse: t("nav.collapse"),
      expand: t("nav.expand"),
      commandPalette: t("nav.commandPalette"),
      signOut: t("nav.signOut"),
      more: t("nav.more"),
      moreTitle: t("nav.moreTitle"),
      shortcutHint: isMac ? "⌘K" : "Ctrl K",
    }),
    [t],
  );

  // Content width (Issue #305 — every section/tab is unified to a centered
  // ~1120px column, max-w-lumen-wide). The only thing that varies now is the
  // SCROLL OWNERSHIP, so PageContainer still gets two variants (both clamped to
  // max-w-lumen-wide, see PageContainer.tsx):
  //   - "fluid": canvas/board surfaces that own their full-bleed h-full layout
  //     + self-scroll inside the clamped box (Connect graph, Schedule calendar,
  //     Materials→Tasks Kanban, plus Analytics whose shared view draws its own
  //     centered data column). Their internal horizontal scroll (kanban board /
  //     week grid) stays inside the 1120px column — no page-level scroll.
  //   - "wide": every document surface — PageContainer owns the vertical scroll
  //     wrapper (Notes / Daily / Briefing / Work / Settings / Trash /
  //     Materials→Tags).
  // Mobile is visually unchanged: below 768px the max-w clamp never engages, so
  // both variants render gutter-padded full width.
  const ownsFullBleed =
    section === "connect" ||
    section === "schedule" ||
    section === "analytics" ||
    (section === "materials" && materialsTab === "tasks");
  const pageWidth: PageContainerWidth = ownsFullBleed ? "fluid" : "wide";

  // Detail-panel (rightSidebar) toggle, injected already-translated (§6.4).
  // Desktop = PanelRight at the header-tab row's right end; Mobile = a bordered
  // hamburger at the left of the segment row that opens the left drawer. The
  // toggle flips its own aria-label between the two (open ↔ close action).
  const detailOpenLabel = t("detailPanel.open");
  const detailCloseLabel = t("detailPanel.close");

  // Standard header controls (v2 §1). Left→right: the command-palette search
  // field (#306), then the rightSidebar toggle. Undo/Redo buttons (#304) land
  // between the field and the toggle when that Epic ships; the order is already
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
    ) : section === "schedule" ? (
      <SectionHeader
        tabs={
          <HeaderTabs
            divider={false}
            tabs={[
              { id: "calendar", label: t("scheduleScreen.calendar") },
              { id: "routines", label: t("scheduleScreen.routines") },
            ]}
            activeTab={scheduleTab}
            onSelect={(id) => setScheduleTab(id as ScheduleTab)}
            label={t("section.schedule", { defaultValue: "Schedule" })}
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
            tabs={[
              { id: "morning", label: t("briefing.tabs.morning") },
              { id: "evening", label: t("briefing.tabs.evening") },
            ]}
            activeTab={briefingTab}
            onSelect={(id) => setBriefingTab(id as BriefingTab)}
            label={t("briefing.tabsLabel")}
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

  // The four Materials document surfaces. Provider nesting is verbatim from
  // the old flat sections (§6.2) — only the addressing changed (section+tab).
  const materialsView = (
    <>
      {materialsTab === "tasks" && (
        <WikiTagsUnifiedProvider dataService={ds}>
          <TaskTreeProvider dataService={ds} persistSelection>
            <KanbanView
              pendingNewTask={pendingNewTask}
              onConsumeNewTask={consumeNewTask}
            />
          </TaskTreeProvider>
        </WikiTagsUnifiedProvider>
      )}
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
      {materialsTab === "tags" && (
        <WikiTagsUnifiedProvider dataService={ds}>
          <WikiTagsManagementView />
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
          onNavigate={handleBriefingNavigate}
          tab={briefingTab}
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
        <TaskTreeProvider dataService={ds}>
          <WikiTagsUnifiedProvider dataService={ds}>
            <CalendarProvider dataService={ds}>
              <RoutineProvider dataService={ds}>
                <ScheduleItemsProvider dataService={ds}>
                  <ScheduleScreen
                    dataService={ds}
                    tab={scheduleTab}
                    onTabChange={setScheduleTab}
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
         * ShortcutConfigProvider (W1) is a Mobile 省略 Provider (CLAUDE.md §2),
         * mounted here on the web host only. Per §6.2 Theme is outer (it lives
         * in main.tsx); Shortcut sits inner — here just inside Sync and OUTSIDE
         * the section switch, so the (currently settings-only) consumer reads a
         * stable Provider regardless of the active section.
         */}
        <ShortcutConfigProvider>
          {/*
           * Global shortcut executor (W3-0/W3-B). Headless — sits inside the
           * ShortcutConfigProvider (MainScreen's own body can't read
           * useShortcutConfig) and wires keydown to section nav + palette toggle.
           * Reads the live (rebindable) config, so Settings rebinds apply at
           * once. nav:* + new-task route through the target-IA mapping
           * (handleNavigate / handleNewTask → Materials + tab + create dialog).
           *
           * undo / redo are DEFERRED (plan 2026-07-08 Step 4): the web build
           * has no UndoRedo base (no provider / command stack), so wiring the
           * shortcuts would mean building that whole subsystem — out of scope
           * for this integration pass. Left unwired (no-op) by design, not by
           * omission; revisit when a web UndoRedo provider lands.
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
             * AudioProvider (W3-C) — Mobile 省略 Provider (CLAUDE.md §2), mounted
             * on the web host only, nested INSIDE TimerProvider (§6.2 … → Timer →
             * Audio → …). The headless AudioChimeBridge sits inside it and pipes
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
                  userEmail={session.user.email ?? ""}
                  onSignOut={() => void signOut()}
                  labels={shellLabels}
                  detailPanelLabels={detailPanelLabels}
                  header={sectionHeader}
                >
                  {/*
                   * PageContainer (Layout Standard v1 #180 / v2) owns width +
                   * gutter + scroll for every section. On the WIDE layout the
                   * section chrome now lives in AppShell's header slot (the
                   * standard SectionHeader above), so the header slot here only
                   * carries the NARROW-layout rows: Materials' hamburger +
                   * segmented tab row, and the Connect / Work / Settings
                   * hamburger row (all unchanged from v1 — mobile non-goal).
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
                      header={sectionToolbar ?? undefined}
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
                />
              </RightSidebarProvider>
            </AudioProvider>
          </TimerProvider>
        </ShortcutConfigProvider>
      </SyncProvider>
    </ToastProvider>
  );
}
