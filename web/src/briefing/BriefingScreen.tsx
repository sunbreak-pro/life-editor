import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import {
  BriefingView,
  BriefingVizPanel,
  EveningReflectionPreview,
  EveningView,
  GoalTodoLinkScreen,
  ItemCreatePanel,
  ItemDetailOverlay,
  MorningGoalsBlock,
  PeriodEndReviewCard,
  RepeatScopeDialog,
  RightSidebarPortal,
  TodayTodoTray,
  eveningBodyLines,
  goalMarkTitles,
  goalPeriodRanges,
  goalProgressText,
  hasIntentionToReport,
  periodStartDateKey,
  todayDateKey,
  useMediaQuery,
  useTranslation,
  type BriefingTab,
  type DataService,
  type GoalPeriodKind,
  type GoalTodoLinkScreenLabels,
  type ItemCreateNoteDraft,
  type ItemCreateSlot,
  type MorningGoalsLabels,
  WEEK_STARTS_ON,
  WIDE_QUERY,
} from "@life-editor/shared";
import type { NavDestination } from "../hooks/useShellNavigation";
import { LazyRichTextEditor } from "../notes/LazyRichTextEditor";
import { preloadRichTextEditor } from "../notes/preloadRichTextEditor";
import { useBriefingData } from "./hooks/useBriefingData";
import { useDailySections } from "./hooks/useDailySections";
import { useFocusNote } from "./hooks/useFocusNote";
import { useMorningGoals } from "./hooks/useMorningGoals";
import { useNoteGoalsMigration } from "./hooks/useNoteGoalsMigration";

/*
 * Briefing host shell (Briefing plan Step 1). Owns data fetching (it may
 * call the injected DataService — §6.4) and i18n `t`, then injects the
 * aggregated BriefingData + labels into the pure shared <BriefingView>.
 *
 * The data/aggregation half lives in useBriefingData and the 夕刊 / 宣言
 * editing state in useDailySections (hooks split — zero behavior change);
 * this component resolves the i18n labels and assembles the views.
 *
 * The rightSidebar detail panel is fed from here too (#413): the SHARED
 * <TodayTodoTray> — Schedule's tray component (#298), not a copy — pushed
 * through RightSidebarPortal. See the tray block below for the wiring.
 */

interface BriefingScreenProps {
  dataService: DataService;
  onNavigate: (dest: NavDestination) => void;
  /**
   * Open ONE item where it lives — the shell's `navigateToItem` (#1824).
   *
   * The paper's row「編集」used to call `onNavigate({ section: "schedule" })`,
   * which lands on the section and stops: no selection, no panel, nothing to
   * edit. This is the intent the "[[" links and the command palette already
   * travel on, and Schedule already consumes it (`pendingSelectTodoId` /
   * `pendingSelectEvent`), so the row only has to name its own item.
   *
   * Optional, and the section switch is the fallback: the paper renders in
   * tests and on hosts that mount no item navigation, and a jump that lands on
   * the right section is still better than a dead button.
   */
  onNavigateToItem?: (target: {
    id: string;
    role: string;
    date?: string;
  }) => void;
  /** Active header tab (朝刊 / 夕刊, #263 F-6) — lifted to MainScreen. */
  tab: BriefingTab;
  /**
   * Narrow-layout tab band, passed straight through to the paper views (#318).
   * MainScreen builds it (it owns `tab` + the i18n copy) and leaves it
   * undefined on the wide layout, where the SectionHeader renders the tabs.
   */
  tabSwitcher?: ReactNode;
  /**
   * Open Connect's "Goals & Todos" tab (#2106) — where a goal is renamed,
   * deleted or re-parented, and where month / year goals are made. Optional
   * like `onNavigateToItem`; without it the goals block draws no link.
   */
  onOpenGoals?: () => void;
}

const GOAL_KINDS: readonly GoalPeriodKind[] = ["year", "month", "week"];

export function BriefingScreen({
  dataService: ds,
  onNavigate,
  onNavigateToItem,
  tab,
  tabSwitcher,
  onOpenGoals,
}: BriefingScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  // 宣言 editability on the EVENING paper (#391). Wide: the evening paper only
  // reads the stored declaration back, and since #2106 nothing on the wide
  // layout writes it — the morning paper's field is gone (the stored text is
  // kept). Below 768px 夕刊 is a Quick capture surface (mobile-scope #3), so
  // the same block is the live input there, and the only place 宣言 is
  // written. Own matchMedia read, like MainScreen's and AppShell's (same
  // 768px query — §W5 app shell).
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const intentionEditableOnEvening = !isWide;

  const todayKey = todayDateKey();

  const {
    loading,
    data,
    todosRead,
    dateLine,
    dailyContent,
    setDailyContent,
    remainingTodos,
    upcoming,
    handleToggleTodo,
    handleSetTodoStatus,
    handleDeleteScheduleItem,
    handleDeleteTodo,
    deleteScopeItem,
    handleDeleteScopeChoose,
    closeDeleteScope,
    noteOptions,
    handleCreateEvent,
    handleCreateTodo,
    handlePlaceTodo,
    todoPlaced,
    todoUnplaced,
    todoAddable,
    handleAddTodoCandidate,
  } = useBriefingData(ds, todayKey);

  const {
    eveningStored,
    eveningGen,
    eveningMood,
    eveningSaved,
    hasEveningToReport,
    markEveningDirty,
    handleEveningUpdate,
    handleSelectMood,
    intentionStored,
    intentionDraft,
    intentionText,
    intentionSaved,
    handleIntentionChange,
    flushIntention,
  } = useDailySections(ds, todayKey, dailyContent, setDailyContent);

  // The goals note's current-period lines become goal rows, once (#2105). It
  // only READS the note — nothing on the paper writes to it any more (#2106).
  // The goals below are read after it settles, so they include what it moved.
  const goalsMigrated = useNoteGoalsMigration(ds, todayKey);

  // Goals are rows since #2101, and the paper reads them (#2106): this week's
  // goals, the marks on the todo rows and the period-end review. The free-text
  // 週 / 月 / 年 fields over the goals note are gone from the paper.
  const {
    state: goalState,
    goals: morningGoals,
    review,
    reviewBusy,
    writing: goalWriting,
    decide,
    askLater,
    createWeekGoal,
    writeLinks,
  } = useMorningGoals(ds, todayKey, data.todoNodes, todosRead, goalsMigrated);

  // The focus note (#1048) — its own document too: the morning paper READS
  // today's focus (written last evening), the evening paper EDITS tomorrow's.
  const {
    todayFocus,
    focusDraft,
    focusLoading,
    handleFocusChange,
    flushFocus,
  } = useFocusNote(ds, todayKey);

  // Nothing stored AND nothing typed = the day has no declaration yet, so
  // there is no save state to report. Reporting「保存済み」over an untouched
  // empty field reads as "already done" (#427) — omit the caption entirely
  // until the first character exists somewhere.
  const intentionCaption = !hasIntentionToReport(
    intentionStored.text,
    intentionDraft,
  )
    ? undefined
    : intentionSaved
      ? t("materials.daily.saved")
      : t("materials.daily.unsaved");

  // ── Labels (§6.4 — resolved here, injected as props) ─────────────────
  const labels = useMemo(
    () => ({
      masthead: t("briefing.masthead"),
      focusLabel: t("briefing.focusLabel"),
      aiTitle: t("briefing.aiTitle"),
      aiSource: t("briefing.aiSource"),
      noFocus: t("briefing.noFocus"),
      goalMark: t("briefing.goalMark"),
      scheduleTitle: t("briefing.scheduleTitle"),
      addScheduleItem: t("briefing.addScheduleItem"),
      noSchedule: t("briefing.noSchedule"),
      routineTag: t("briefing.routineTag"),
      allDay: t("briefing.allDay"),
      carryoverTitle: t("briefing.carryoverTitle"),
      // The carryover rows draw the shared todo checkbox since #1368, so they
      // name their status with the same words 夕刊 and the Todos section use.
      todoStatus: t("todoDetail.status"),
      statusNotStarted: t("todoDetail.statusNotStarted"),
      statusDone: t("todoDetail.statusDone"),
      edit: t("briefing.edit"),
      delete: t("briefing.delete"),
      deleteScheduleHint: t("briefing.deleteScheduleHint"),
      deleteTodoHint: t("briefing.deleteTodoHint"),
      jumpToSchedule: t("briefing.jumpToSchedule"),
      jumpToTodos: t("briefing.jumpToTodos"),
    }),
    [t],
  );
  // Goal period copy (#872 → #2106). The period RANGES are computed, not
  // translated — the human-readable face of the same period a goal is filed
  // under. The week is the app-wide start (#1102) — the same boundary the
  // calendar grids and the Analytics week buckets use (#860), never a
  // hard-coded Monday.
  const locale = i18n.language.startsWith("ja") ? "ja-JP" : "en-US";
  const goalRanges = useMemo(
    () => goalPeriodRanges(todayKey, WEEK_STARTS_ON, locale),
    [todayKey, locale],
  );
  const morningGoalsLabels = useMemo<MorningGoalsLabels>(() => {
    const periods = Object.fromEntries(
      GOAL_KINDS.map((kind) => [
        kind,
        `${t(`connect.goals.periods.${kind}`)} ${goalRanges[kind]}`,
      ]),
    ) as Record<GoalPeriodKind, string>;
    return {
      title: t("briefing.goalsTitle"),
      periods,
      prompt: t("briefing.goals.prompt"),
      achieved: t("goalLink.achieved"),
      unconnected: t("goalLink.unconnected"),
      linkTodos: t("goalLink.heading"),
      linkTodosFor: (title) => t("briefing.goals.linkTodos", { title }),
      addLabel: t("connect.goals.addHeading"),
      addPlaceholder: t("connect.goals.addPlaceholder"),
      add: t("connect.goals.add"),
      adding: t("goalLink.saving"),
      limit: t("connect.goals.limit", {
        period: t("connect.goals.periods.week"),
      }),
      openInConnect: t("briefing.goals.openInConnect"),
    };
  }, [t, goalRanges]);
  // The linking screen's copy: the same goalLink.* words Connect opens it with.
  const goalLinkLabels = useMemo<GoalTodoLinkScreenLabels>(
    () => ({
      heading: t("goalLink.heading"),
      periodLabel: morningGoalsLabels.periods.week,
      search: t("goalLink.search"),
      listLabel: t("goalLink.todoList"),
      empty: t("goalLink.empty"),
      noMatch: t("goalLink.noMatch"),
      done: t("goalLink.done"),
      previewHeading: t("goalLink.previewHeading"),
      achievementLost: t("goalLink.achievementLost"),
      save: t("goalLink.save"),
      saving: t("goalLink.saving"),
      cancel: t("goalLink.cancel"),
      saveFailed: t("goalLink.saveFailed"),
      unconnected: t("goalLink.unconnected"),
      achieved: t("goalLink.achieved"),
      becomesAchieved: t("goalLink.becomesAchieved"),
      losesAchievement: t("goalLink.losesAchievement"),
    }),
    [t, morningGoalsLabels],
  );

  // Widget copy re-uses the EXISTING analytics.* keys (Analytics shrink:
  // the three widgets moved in here — their labels come along unduplicated).
  // Since #938 they dress <BriefingVizPanel> in the detail panel rather than a
  // section of the paper; the resolution is unchanged.
  const streakLabels = useMemo(
    () => ({
      title: t("analytics.streak.title"),
      current: t("analytics.streak.current"),
      longest: t("analytics.streak.longest"),
      formatDays: (count: number) => t("analytics.streak.days", { count }),
      noStreak: t("analytics.streak.noStreak"),
    }),
    [t],
  );
  const trendLabels = useMemo(
    () => ({
      title: t("analytics.todoTrend.title"),
      completedCount: t("analytics.todoTrend.completedCount"),
    }),
    [t],
  );
  const balanceLabels = useMemo(
    () => ({
      title: t("analytics.workBreak.title"),
      work: t("analytics.workBreak.work"),
      break: t("analytics.workBreak.break"),
      longBreak: t("analytics.workBreak.longBreak"),
    }),
    [t],
  );

  const eveningLabels = useMemo(
    () => ({
      masthead: t("briefing.evening.masthead"),
      moodTitle: t("briefing.evening.moodTitle"),
      moodStars: [1, 2, 3, 4, 5].map((n) =>
        t("briefing.evening.moodStar", { value: n }),
      ),
      // Editable → it is today's declaration you are writing, not this
      // morning's read back, so the heading follows the mode (#391).
      intentionTitle: intentionEditableOnEvening
        ? t("briefing.intentionTitle")
        : t("briefing.evening.intentionTitle"),
      intentionCaption,
      intentionPlaceholder: t("briefing.evening.intentionPlaceholder"),
      reflectionTitle: t("briefing.evening.reflectionTitle"),
      // No caption at all on a day with nothing written (#1822) — the same
      // shape `intentionCaption` takes above.
      savedCaption: !hasEveningToReport
        ? undefined
        : eveningSaved
          ? t("materials.daily.saved")
          : t("materials.daily.unsaved"),
      focusTitle: t("briefing.evening.focusTitle"),
      focusPlaceholder: t("briefing.evening.focusPlaceholder"),
      todosTitle: t("briefing.evening.todosTitle"),
      noTodos: t("briefing.evening.noTodos"),
      // The three statuses are worded ONCE, in the Todos section's own copy —
      // a briefing.* paraphrase of「未着手」would be a second vocabulary for
      // the same three values (#796).
      todoStatus: t("todoDetail.status"),
      statusNotStarted: t("todoDetail.statusNotStarted"),
      statusDone: t("todoDetail.statusDone"),
      upcomingTitle: t("briefing.evening.upcomingTitle"),
      noUpcoming: t("briefing.evening.noUpcoming"),
      tomorrowTag: t("briefing.evening.tomorrowTag"),
      allDay: t("briefing.allDay"),
    }),
    [
      t,
      eveningSaved,
      hasEveningToReport,
      intentionCaption,
      intentionEditableOnEvening,
    ],
  );

  /*
   * Row「編集」— open the item itself (#1824).
   *
   * `navigateToItem` is the shell's own item intent; the bare section switch
   * is what happens on a host that has none, which is the old behaviour rather
   * than a dead button. An event travels with its DATE as well as its id
   * (#503): the Calendar shows one window at a time, so an id alone would
   * select a row on whatever week happens to be open. Every row on this paper
   * is today's.
   */
  const openItem = useCallback(
    (id: string, role: "task" | "event") => {
      if (onNavigateToItem === undefined) {
        onNavigate({ section: "schedule" });
        return;
      }
      onNavigateToItem(
        role === "event" ? { id, role, date: todayKey } : { id, role },
      );
    },
    [onNavigateToItem, onNavigate, todayKey],
  );

  // ── Creation panel (#623) ────────────────────────────────────────────
  // Schedule's shared <ItemCreatePanel>, reached from the paper's「+」and the
  // rightSidebar's. No briefing-specific creation form: the same act would
  // otherwise exist in two implementations that drift apart.
  //
  // The panel opens on the day the paper is showing — that is the「+」gesture
  // — but since #940 the day is an input rather than a caption, so "add this
  // to today" is the default here, not the only thing on offer. Anything
  // booked for another day is written and simply does not join today's paper
  // (useBriefingWrites keeps the lists honest).
  /*
   * Whether the evening reflection is showing its editor or its text (#1115).
   *
   * It starts as text. The editor is TipTap, the single heaviest chunk in the
   * app, and `defaultBriefingTab()` opens this paper from 17:00 on the default
   * landing section — so mounting it on arrival fetched 118 KB gzip on every
   * evening session whether or not anyone meant to write. The press is what
   * asks for it.
   *
   * Reset as a render-phase adjustment rather than an effect (useDailySections'
   * pattern): idempotent under StrictMode's double render, and it lands before
   * paint.
   *
   * Reset on the TAB as well as the day, because the two tabs return different
   * trees from this component — leaving the evening paper unmounts the editor
   * either way, so a sticky latch would only mean the paper comes back already
   * in edit mode (and, with the focus rule below, popping the on-screen
   * keyboard). Arriving at the evening paper looks the same every time.
   *
   * `focusOnGen` is what keeps the focus tied to the PRESS. `eveningGen` is in
   * the editor's key, and useDailySections bumps it whenever the stored body
   * changes underneath us (another device, an MCP upsert_daily), so the editor
   * remounts — and TipTap re-applies `autofocus` on every construction. Left
   * unguarded, an external write while the caret sat in TOMORROW'S FOCUS would
   * yank it back into the reflection mid-sentence. Recording the generation
   * the press happened on means only that mount focuses.
   */
  const [editingEvening, setEditingEvening] = useState(false);
  const [focusOnGen, setFocusOnGen] = useState<number | null>(null);
  const editingScope = `${tab}:${todayKey}`;
  const [editingScopeSeen, setEditingScopeSeen] = useState(editingScope);
  if (editingScopeSeen !== editingScope) {
    setEditingScopeSeen(editingScope);
    if (editingEvening) setEditingEvening(false);
    if (focusOnGen !== null) setFocusOnGen(null);
  }

  const startEditingEvening = useCallback(() => {
    setEditingEvening(true);
    setFocusOnGen(eveningGen);
  }, [eveningGen]);

  const eveningLines = useMemo(
    () => eveningBodyLines(eveningStored.bodyDocJson),
    [eveningStored],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const openCreatePanel = useCallback(() => setCreateOpen(true), []);
  const closeCreatePanel = useCallback(() => setCreateOpen(false), []);

  const formatDuration = useCallback(
    (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (h === 0) return t("scheduleScreen.durationMin", { m });
      if (m === 0) return t("scheduleScreen.durationHour", { h });
      return t("scheduleScreen.durationHourMin", { h, m });
    },
    [t],
  );

  // The panel's copy comes from the EXISTING scheduleScreen.* keys, not a
  // briefing.* copy of them: it is literally Schedule's panel, and a second
  // catalogue of the same sentences is a divergence waiting to happen.
  const createPanelLabels = useMemo(
    () => ({
      typeLabel: t("scheduleScreen.itemTypeLabel"),
      typeEvent: t("scheduleScreen.typeEvent"),
      typeTodo: t("scheduleScreen.typeTodo"),
      title: t("scheduleScreen.title"),
      eventPlaceholder: t("scheduleScreen.quickAddPlaceholder"),
      todoPlaceholder: t("scheduleScreen.todoPlaceholder"),
      date: t("scheduleScreen.date"),
      allDay: t("scheduleScreen.allDay"),
      startTime: t("scheduleScreen.startTime"),
      endTime: t("scheduleScreen.endTime"),
      addEvent: t("scheduleScreen.addEvent"),
      addEventAndOpen: t("scheduleScreen.addEventAndOpen"),
      sourceLabel: t("scheduleScreen.sourceLabel"),
      sourceNew: t("scheduleScreen.sourceNew"),
      sourceExisting: t("scheduleScreen.sourceExisting"),
      addTodo: t("scheduleScreen.addTodo"),
      placeTodo: t("scheduleScreen.placeTodo"),
      searchTodos: t("scheduleScreen.searchTodos"),
      todoPickerEmpty: t("scheduleScreen.todoEmptyAddable"),
      todoPickerNoMatch: t("scheduleScreen.todoPickerNoMatch"),
      attachNote: t("scheduleScreen.attachNote"),
      noteSourceLabel: t("scheduleScreen.noteSourceLabel"),
      noteSourceNew: t("scheduleScreen.noteSourceNew"),
      noteSourceExisting: t("scheduleScreen.noteSourceExisting"),
      noteTitleLabel: t("scheduleScreen.noteTitleLabel"),
      notePlaceholder: t("scheduleScreen.notePlaceholder"),
      searchNotes: t("scheduleScreen.searchNotes"),
      notePickerEmpty: t("scheduleScreen.notePickerEmpty"),
      notePickerNoMatch: t("scheduleScreen.notePickerNoMatch"),
      noteLinkHint: t("scheduleScreen.noteLinkHint"),
      attachedNote: t("scheduleScreen.attachedNote"),
      clearNote: t("scheduleScreen.clearNote"),
    }),
    [t],
  );

  const submitEvent = useCallback(
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      handleCreateEvent(title, slot, note);
      closeCreatePanel();
    },
    [handleCreateEvent, closeCreatePanel],
  );

  // The panel's second event button means "create, then open its editor".
  // The paper has no event editor of its own, so the honest reading here is
  // to create and then go to Schedule, where that editor lives.
  const submitEventAndOpen = useCallback(
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      handleCreateEvent(title, slot, note);
      closeCreatePanel();
      onNavigate({ section: "schedule" });
    },
    [handleCreateEvent, closeCreatePanel, onNavigate],
  );

  const submitTodo = useCallback(
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      handleCreateTodo(title, slot, note);
      closeCreatePanel();
    },
    [handleCreateTodo, closeCreatePanel],
  );

  const submitPlaceTodo = useCallback(
    (
      todoId: string,
      slot: ItemCreateSlot,
      note: ItemCreateNoteDraft | null,
    ) => {
      handlePlaceTodo(todoId, slot, note);
      closeCreatePanel();
    },
    [handlePlaceTodo, closeCreatePanel],
  );

  const todoTrayLabels = useMemo(
    () => ({
      placedHeading: t("briefing.todo.placedHeading"),
      emptyPlaced: t("briefing.todo.emptyPlaced"),
      addHeading: t("briefing.todo.addHeading"),
      // A todo with no time is an all-day row on the merged list (#795) — the
      // paper's own word for it, not a tray-only synonym.
      allDay: t("briefing.allDay"),
      addAction: t("briefing.todo.addAction"),
      emptyAddable: t("briefing.todo.emptyAddable"),
      openInTodos: t("briefing.jumpToTodos"),
      // Same statuses the paper's rows show — the tray must not disagree with
      // the list it sits beside (#796).
      status: t("todoDetail.status"),
      statusLabels: {
        statusNotStarted: t("todoDetail.statusNotStarted"),
        statusDone: t("todoDetail.statusDone"),
      },
    }),
    [t],
  );

  // Every width (#609). This used to be wide-only, and for a real reason:
  // below 768px the detail panel is a MobileDrawer, and Briefing had no opener
  // for it at all — the wide SectionHeader toggle is gone at that width and
  // the standalone hamburger row (MOBILE_HAMBURGER_SECTIONS) belongs to
  // sections whose body is a list — so a tray mounted here was unreachable UI.
  // MainScreen now puts the hamburger at the left edge of Briefing's narrow
  // 朝刊/夕刊 band, which is the opener that was missing; `docs/requirements/
  // mobile-scope.md` #1 moved with it.
  //
  // No `isWide` guard of its own: <RightSidebarPortal> renders nothing while
  // the panel is closed and only registers that content exists, so mounting it
  // at every width costs a subscription, not a surface.
  //
  // Mounted on BOTH papers (朝刊 / 夕刊): the panel is section-level, and the
  // tray is as useful when closing the day as when starting it.
  const todoTrayPortal = (
    <RightSidebarPortal>
      <div className="flex flex-col gap-3">
        {/* #623: the panel's own「+」. Same target as the paper's — the two
            are one action reached from two places, so they open the same
            creation panel on the same day. 朝刊 only: the tray is mounted on
            both papers, but 夕刊 is explicitly outside this Issue's scope, and
            a「+」there would read as "add to tomorrow". */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-lumen-text">
            {t("briefing.todo.title")}
          </h3>
          {tab === "morning" && (
            <button
              type="button"
              onClick={openCreatePanel}
              aria-label={t("briefing.addScheduleItem")}
              title={t("briefing.addScheduleItem")}
              /* The 44px floor (#1559). This is the SECOND button carrying
                 「今日のスケジュールに追加」— the paper draws the first — and
                 since #609 the drawer that holds this one opens below 768px,
                 so both are narrow targets and both have to clear the floor.
                 Plain box growth rather than the paper's invisible ::after:
                 the tray is a stack with a 12px `gap-3` and no ruled rhythm to
                 protect, so letting the header row grow costs nothing here. */
              className="-my-1 -mr-1.5 flex flex-shrink-0 items-center justify-center rounded-lumen-sm p-1.5 text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-briefing-shu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 max-md:min-w-11"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <TodayTodoTray
          placed={todoPlaced}
          unplaced={todoUnplaced}
          addable={todoAddable}
          // One list, not「Todo 一覧 → 候補 → 予定済み」(#795). Picking a todo
          // and it appearing where it now lives is ONE act; naming the middle
          // of it「候補」made the tray describe its own bookkeeping.
          singleList
          onToggleComplete={handleToggleTodo}
          onSetStatus={handleSetTodoStatus}
          onOpenTodo={() => onNavigate({ section: "schedule" })}
          onAddCandidate={handleAddTodoCandidate}
          labels={todoTrayLabels}
        />
      </div>
    </RightSidebarPortal>
  );

  // 「きのうまでの自分」(#938) — the paper's old visual zone, now a second
  // panel in the SAME detail well as the tray above. Two <RightSidebarPortal>s
  // stack in mount order, so no tab strip and no second sidebar mechanism: the
  // tray (today) reads first, the charts (up to yesterday) below it.
  //
  // 朝刊 only. The tray is mounted on both papers because a todo list is as
  // useful when closing the day as when starting it, but these three widgets
  // are the morning paper's own block and 夕刊 is out of this Issue's scope.
  //
  // Narrow reaches it exactly the way it reaches the tray: since #609 the
  // detail panel is a MobileDrawer opened from the hamburger at the left edge
  // of the 朝刊/夕刊 band, so no width gate is needed here either
  // (`docs/requirements/mobile-scope.md` #1).
  const vizPortal = (
    <RightSidebarPortal>
      <BriefingVizPanel
        sessions={data.sessions}
        todoNodes={data.todoNodes}
        title={t("briefing.vizTitle")}
        streakLabels={streakLabels}
        trendLabels={trendLabels}
        balanceLabels={balanceLabels}
      />
    </RightSidebarPortal>
  );

  // ── Goals (#2106) ────────────────────────────────────────────────────
  // The todo rows carry the titles of the goals they serve. Before the goals
  // read lands the rows simply have no marks, as on a host without goals.
  const paperData = useMemo(
    () =>
      goalState === null
        ? data
        : {
            ...data,
            todos: data.todos.map((todo) => ({
              ...todo,
              goals: goalMarkTitles(goalState, todo.id),
            })),
          },
    [data, goalState],
  );

  // Goal-side linking (goal → its todos) opens the shared screen Connect uses
  // (#2109) in the paper's own overlay — the right panel already holds the
  // tray and the charts. The overlay's title already says「Todo をつなぐ」, so
  // the screen drops its own kicker. Saving keeps it open, so the
  // 「達成が外れました」a save can raise stays on screen; closing is the
  // reader's.
  const [linkGoalId, setLinkGoalId] = useState<string | null>(null);
  const closeLinkScreen = useCallback(() => setLinkGoalId(null), []);
  const linkTodoOptions = useMemo(
    () =>
      data.todoNodes
        .filter((n) => n.type === "task" && !n.isDeleted)
        .map((n) => ({ id: n.id, title: n.title, done: n.status === "DONE" })),
    [data.todoNodes],
  );
  // `fitViewport` (#1728): the screen runs to ~700px once the preview shows,
  // taller than a phone's viewport — unbounded, Save fell below the fold.
  // Open only while the goal is live: deleted elsewhere (Connect on another
  // device, MCP) mid-edit, the screen renders nothing and the dialog would
  // stand empty around it.
  const linkGoalLive =
    linkGoalId !== null &&
    goalState?.goals.some((g) => g.id === linkGoalId && !g.isDeleted) === true;
  const goalLinkOverlay = (
    <ItemDetailOverlay
      open={linkGoalLive}
      title={t("goalLink.heading")}
      onClose={closeLinkScreen}
      fitViewport
    >
      {linkGoalLive && goalState !== null && linkGoalId !== null && (
        <GoalTodoLinkScreen
          key={linkGoalId}
          goalId={linkGoalId}
          state={goalState}
          todos={linkTodoOptions}
          onSave={(diff) =>
            writeLinks(
              diff.link.map((todoId) => ({ goalId: linkGoalId, todoId })),
              diff.unlink.map((todoId) => ({ goalId: linkGoalId, todoId })),
            )
          }
          onClose={closeLinkScreen}
          labels={goalLinkLabels}
          headingShown={false}
        />
      )}
    </ItemDetailOverlay>
  );

  // The period-end review (P1 / P2), one goal at a time, above this week's
  // goals. Its period is printed with the same range formatter as the current
  // ones, fed a day inside that past period.
  const reviewCard =
    review === null ? null : (
      <PeriodEndReviewCard
        key={review.item.goal.id}
        goalTitle={review.item.goal.title}
        connected={review.item.progress.connected}
        canCarry={review.carry.existingId !== null || review.carry.hasRoom}
        busy={reviewBusy}
        locked={goalWriting}
        labels={{
          title: t("briefing.review.title"),
          remaining: t("briefing.review.remaining", {
            count: review.remaining,
          }),
          periodLabel: t("connect.goals.period", {
            kind: t(`connect.goals.kinds.${review.item.goal.periodKind}`),
            key: goalPeriodRanges(
              periodStartDateKey(
                review.item.goal.periodKind,
                review.item.goal.periodKey,
              ),
              WEEK_STARTS_ON,
              locale,
            )[review.item.goal.periodKind],
          }),
          question: t("briefing.review.question"),
          progress: goalProgressText(review.item.progress, {
            unconnected: t("goalLink.unconnected"),
          }),
          carry: t("briefing.review.carry"),
          drop: t("briefing.review.drop"),
          achieve: t("briefing.review.achieve"),
          later: t("briefing.review.later"),
          carryBlocked:
            review.carry.existingId === null && !review.carry.hasRoom
              ? t("connect.goals.limit", {
                  period: t(
                    `connect.goals.periods.${review.item.goal.periodKind}`,
                  ),
                })
              : undefined,
          saving: t("goalLink.saving"),
        }}
        onDecide={decide}
        onLater={askLater}
      />
    );

  // Nothing at all until the goals read lands (or when it fails): an empty
  // block first would flash「今週の目標を立てましょう」over goals that exist.
  const goalsSlot =
    morningGoals === null ? null : (
      <>
        {reviewCard}
        <MorningGoalsBlock
          goals={morningGoals}
          labels={morningGoalsLabels}
          onLinkTodos={setLinkGoalId}
          onCreateWeekGoal={createWeekGoal}
          writing={goalWriting}
          onOpenGoals={onOpenGoals}
        />
      </>
    );

  // Keyed on the day so a paper that crosses midnight (or the day-start hour)
  // re-seeds the fields rather than keeping a draft aimed at yesterday.
  const createPanelOverlay = (
    <ItemDetailOverlay
      open={createOpen}
      title={t("scheduleScreen.addItem")}
      onClose={closeCreatePanel}
    >
      <ItemCreatePanel
        key={todayKey}
        initial={{ date: todayKey }}
        pools={{ todos: todoAddable, notes: noteOptions }}
        handlers={{
          onSubmitEvent: submitEvent,
          onSubmitEventAndOpen: submitEventAndOpen,
          onCreateTodo: submitTodo,
          onPlaceTodo: submitPlaceTodo,
        }}
        formatDuration={formatDuration}
        labels={createPanelLabels}
      />
    </ItemDetailOverlay>
  );

  // #585: deleting a routine-derived row asks which occurrences first — the
  // SAME <RepeatScopeDialog> Schedule uses (#279), with the same copy. The
  // component is imported read-only; the delete semantics behind each choice
  // live in useBriefingData.
  const deleteScopeDialog = (
    <RepeatScopeDialog
      open={deleteScopeItem !== null}
      mode="delete"
      labels={{
        title: t("scheduleScreen.deleteScopeTitle"),
        thisOnly: t("scheduleScreen.scopeThisOnly"),
        thisAndFuture: t("scheduleScreen.scopeThisAndFuture"),
        all: t("scheduleScreen.scopeAll"),
        cancel: t("scheduleScreen.scopeCancel"),
        // #1974: "this and following" is undoable from the paper now, and the
        // undo does not bring the series' tags back — the condition
        // D-20260919-sched-2 = B was granted on. This dialog only ever asks in
        // delete mode, so the note always applies here.
        thisAndFutureNote: t("scheduleScreen.scopeDeleteFutureTagNote"),
      }}
      onChoose={handleDeleteScopeChoose}
      onClose={closeDeleteScope}
    />
  );

  if (tab === "evening") {
    return (
      <>
        {todoTrayPortal}
        <EveningView
          loading={loading || focusLoading}
          dateLine={dateLine}
          mood={eveningMood}
          onSelectMood={handleSelectMood}
          editorSlot={
            editingEvening ? (
              <LazyRichTextEditor
                key={`evening:${todayKey}:${eveningGen}`}
                noteId={`evening-${todayKey}`}
                initialContent={eveningStored.bodyDocJson ?? undefined}
                onUpdate={handleEveningUpdate}
                // The caption's other half (#1822): `onUpdate` is 800ms late,
                // so without this the page reads「Saved」while the keystroke
                // is still only on screen.
                onDirty={markEveningDirty}
                placeholder={t("briefing.evening.placeholder")}
                className="min-h-[180px] px-4 py-3"
                autoFocus={focusOnGen === eveningGen}
              />
            ) : (
              <EveningReflectionPreview
                lines={eveningLines}
                placeholder={t("briefing.evening.placeholder")}
                editLabel={t("briefing.evening.startEditing")}
                onStartEditing={startEditingEvening}
                onPrefetch={preloadRichTextEditor}
                // 244px, not the editor's own 180: `min-h-[180px]` never binds
                // there because web/src/index.css gives `.note-editor
                // .ProseMirror` a 220px min-height, so the mounted editor
                // measures 220 + py-3. Matching the RESULT is what makes the
                // swap not jump; matching the class would not.
                className="min-h-[244px] px-4 py-3"
              />
            )
          }
          // Editable → the live draft (the field must echo every keystroke).
          // Read-only → the STORED text, never the draft: the read-back is
          // "what is saved as this morning's declaration", and a draft is both
          // un-normalized (raw blank lines / indent the merge would strip) and
          // possibly unsaved (persistIntention swallows failures) — with no
          // caption on that branch, showing it would silently overstate.
          intentionText={
            intentionEditableOnEvening
              ? intentionText
              : (intentionStored.text ?? "")
          }
          intentionEditable={intentionEditableOnEvening}
          onIntentionChange={handleIntentionChange}
          onIntentionBlur={flushIntention}
          focusText={focusDraft}
          onFocusChange={handleFocusChange}
          onFocusBlur={flushFocus}
          todos={remainingTodos}
          onSetTodoStatus={handleSetTodoStatus}
          schedule={upcoming}
          labels={eveningLabels}
          tabSwitcher={tabSwitcher}
        />
      </>
    );
  }

  return (
    <>
      {todoTrayPortal}
      {vizPortal}
      <BriefingView
        // The focus note is a second async document; the line at the top of
        // the paper is read from it, so the skeleton waits for both. The goals
        // read does not hold the paper: nothing on it is an editable field any
        // more (#2106) — the block simply appears when it lands.
        loading={loading || focusLoading}
        data={paperData}
        labels={labels}
        focusText={todayFocus}
        goalsSlot={goalsSlot}
        onToggleTodo={handleToggleTodo}
        onDeleteScheduleItem={handleDeleteScheduleItem}
        onDeleteTodo={handleDeleteTodo}
        onAddScheduleItem={openCreatePanel}
        onJumpToSchedule={(id) => openItem(id, "event")}
        onJumpToTodos={(id) => openItem(id, "task")}
        tabSwitcher={tabSwitcher}
      />
      {deleteScopeDialog}
      {createPanelOverlay}
      {goalLinkOverlay}
    </>
  );
}
