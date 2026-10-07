import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import {
  BriefingView,
  BriefingVizPanel,
  EveningReflectionPreview,
  EveningView,
  ItemCreatePanel,
  ItemDetailOverlay,
  RepeatScopeDialog,
  RightSidebarPortal,
  TodayTodoTray,
  eveningBodyLines,
  eveningDayCounts,
  eveningEvents,
  getDayStartHour,
  goalPeriodRanges,
  goalsMovedToday,
  hasIntentionToReport,
  todayDateKey,
  tomorrowCandidates,
  useGoalLinkSnapshot,
  useTranslation,
  type BriefingTab,
  type DataService,
  type ItemCreateNoteDraft,
  type ItemCreateSlot,
  WEEK_STARTS_ON,
} from "@life-editor/shared";
import type { NavDestination } from "../hooks/useShellNavigation";
import { LazyRichTextEditor } from "../notes/LazyRichTextEditor";
import { preloadRichTextEditor } from "../notes/preloadRichTextEditor";
import { useBriefingData } from "./hooks/useBriefingData";
import { useDailySections } from "./hooks/useDailySections";
import { useEveningIssue } from "./hooks/useEveningIssue";
import { useEveningNotes } from "./hooks/useEveningNotes";
import { useFocusNote } from "./hooks/useFocusNote";
import { useGoalsDoc } from "./hooks/useGoalsDoc";
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
}

export function BriefingScreen({
  dataService: ds,
  onNavigate,
  onNavigateToItem,
  tab,
  tabSwitcher,
}: BriefingScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  // The evening paper no longer carries the 宣言 block at any width (#2107 —
  // plan Step 8): neither the wide read-back nor the narrow input of #391.
  // The declaration's data is untouched; the morning paper still edits it.

  const todayKey = todayDateKey();

  const {
    loading,
    data,
    dateLine,
    dailyContent,
    setDailyContent,
    scheduleItems,
    eveningNotes,
    setEveningNotes,
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
    handlePlaceTodoTomorrow,
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
    queueDailyWrite,
    intentionStored,
    intentionDraft,
    intentionText,
    intentionSaved,
    handleIntentionChange,
    flushIntention,
  } = useDailySections(ds, todayKey, dailyContent, setDailyContent);

  // 週 / 月 / 年 goals (#872) — their own document (the reserved goals note),
  // so their read + save chain is separate from the daily's sections. The day
  // goes IN because the sections are filed under a period key since #957; the
  // week start it is paired with is the app-wide constant (#1102), so the key a
  // save writes cannot move under a goal that is already on screen.
  const { goals, goalsLoading, handleGoalChange, flushGoals } = useGoalsDoc(
    ds,
    todayKey,
  );

  // The same note's current-period lines become goals, once (#2105). It only
  // reads the note, so it runs beside useGoalsDoc rather than on its chain.
  useNoteGoalsMigration(ds, todayKey);

  // The focus note (#1048) — its own document too: the morning paper READS
  // today's focus (written last evening), the evening paper EDITS tomorrow's.
  const {
    todayFocus,
    focusDraft,
    focusLoading,
    handleFocusChange,
    flushFocus,
  } = useFocusNote(ds, todayKey);

  // ── Evening paper data (#2107) ─────────────────────────────────────────
  // The goals and their links, read only while 夕刊 is open. The live todo
  // tree goes in so the tree is not read twice (ScheduleTodoDetail's shape).
  const goalSnapshot = useGoalLinkSnapshot(ds, {
    active: tab === "evening",
    todos: data.todoNodes,
  });
  const goalsFailed = goalSnapshot.state === null && goalSnapshot.failed;
  const eveningIssueNow = useEveningIssue(
    ds,
    todayKey,
    dailyContent,
    tab === "evening",
  );
  const { saveNote } = useEveningNotes(
    ds,
    todayKey,
    setEveningNotes,
    queueDailyWrite,
  );

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
      intentionTitle: t("briefing.intentionTitle"),
      intentionCaption,
      intentionPlaceholder: t("briefing.intentionPlaceholder"),
      goalsTitle: t("briefing.goalsTitle"),
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
    [t, intentionCaption],
  );
  // Goal field copy (#872). The period RANGES are computed, not translated —
  // they are the human-readable face of the same period the section is filed
  // under (#957), so they take the identical inputs `goalPeriodKeys` does. The
  // week is the app-wide start (#1102) — the same boundary the calendar
  // grids and the Analytics week buckets use (#860), never a hard-coded
  // Monday.
  const goalRanges = useMemo(
    () =>
      goalPeriodRanges(
        todayKey,
        WEEK_STARTS_ON,
        i18n.language.startsWith("ja") ? "ja-JP" : "en-US",
      ),
    [todayKey, i18n.language],
  );
  const goalLabels = useMemo(
    () => ({
      week: {
        title: t("briefing.goals.weekTitle"),
        range: goalRanges.week,
        placeholder: t("briefing.goals.weekPlaceholder"),
      },
      month: {
        title: t("briefing.goals.monthTitle"),
        range: goalRanges.month,
        placeholder: t("briefing.goals.monthPlaceholder"),
      },
      year: {
        title: t("briefing.goals.yearTitle"),
        range: goalRanges.year,
        placeholder: t("briefing.goals.yearPlaceholder"),
      },
    }),
    [t, goalRanges],
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
      goalsTitle: t("briefing.evening.goalsTitle"),
      // A failed goal read takes the empty line's place with its own words:
      //「ありません」there would be a false "none" (#2107 review).
      noGoals: goalsFailed
        ? t("briefing.evening.goalsLoadFailed")
        : t("briefing.evening.noGoals"),
      // The linking screens' own word for it (#2109), not a second one.
      goalAchieved: t("goalLink.achieved"),
      goalRemaining: (count: number) =>
        t("briefing.evening.goalRemaining", { count }),
      eventsTitle: t("briefing.evening.eventsTitle"),
      noEvents: t("briefing.evening.noEvents"),
      // The Todos section's own word, like the statuses above (#796).
      eventDone: t("todoDetail.statusDone"),
      eventWork: t("briefing.evening.eventWork"),
      eventNoteButton: t("briefing.evening.noteButton"),
      eventNoteAdd: (title: string) => t("briefing.evening.noteAdd", { title }),
      eventNoteEdit: (title: string) =>
        t("briefing.evening.noteEdit", { title }),
      eventNotePlaceholder: t("briefing.evening.notePlaceholder"),
      tomorrowTitle: t("briefing.evening.tomorrowTitle"),
      noTomorrow: t("briefing.evening.noTomorrow"),
      tomorrowTimeLabel: (title: string) =>
        t("briefing.evening.tomorrowTime", { title }),
      placeTomorrow: t("briefing.evening.placeTomorrow"),
      placeTomorrowLabel: (title: string) =>
        t("briefing.evening.placeTomorrowLabel", { title }),
      placedTomorrow: (time: string) =>
        t("briefing.evening.placedTomorrow", { time }),
      openDaily: t("briefing.evening.openDaily"),
      openDailyLabel: t("briefing.evening.openDailyLabel", { date: dateLine }),
    }),
    [t, eveningSaved, hasEveningToReport, dateLine, goalsFailed],
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
   * unguarded, an external write while the caret sat in 明日の自分へ would
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

  // ── The evening paper's blocks (#2107) ───────────────────────────────
  // All counting lives in shared/eveningDay.ts — the Daily rebuild (#2123)
  // prints the same numbers — so this only feeds it the day's rows. "Today"
  // runs from the day-start hour (#218), like `todayKey` itself.
  const dayStartHour = getDayStartHour();
  const goalState = goalSnapshot.state;
  // null until the goals and links land: the block then shows nothing rather
  // than「今日進んだ目標はありません」, which would be a false "none" that
  // flips to a real row a moment later. A read that FAILED is not pending,
  // though — the block then stays, printing the failure line (noGoals above)
  // instead of vanishing with no sign (#2107 review).
  const goalMoves = useMemo(
    () =>
      goalState === null
        ? goalsFailed
          ? []
          : null
        : goalsMovedToday({
            goals: goalState.goals,
            links: goalState.links,
            todos: data.todoNodes,
            dateKey: todayKey,
            dayStartHour,
          }),
    [goalState, goalsFailed, data.todoNodes, todayKey, dayStartHour],
  );
  const tomorrowTodos = useMemo(
    () =>
      tomorrowCandidates({
        todos: data.todoNodes,
        goals: goalState?.goals ?? [],
        links: goalState?.links ?? [],
        todayKey,
        dayStartHour,
      }),
    [data.todoNodes, goalState, todayKey, dayStartHour],
  );
  const dayInput = {
    dateKey: todayKey,
    dayStartHour,
    scheduleItems,
    todos: data.todoNodes,
    sessions: data.sessions,
  };
  // `now` on every render, like `upcoming`: an event joins「今日の出来事」
  // once it has started.
  const eveningRows = eveningEvents({ ...dayInput, now: new Date() }).map(
    (row) => ({ ...row, note: eveningNotes?.[row.key] ?? null }),
  );
  // The header's「予定 N」counts the event rows printed under it, not the
  // day's whole schedule: eveningDayCounts counts every event of the day
  // (what #2123's Daily prints for a finished day), but tonight's list holds
  // only those already started, and「予定 3」over one row reads as a bug
  // (#2107 review). The rest are under「今後の予定」.
  const dayCounts = {
    ...eveningDayCounts(dayInput),
    events: eveningRows.filter((row) => row.kind === "event").length,
  };
  // An empty day prints only the「まだありません」line (brief §11): a row of
  // zeros next to it would say the same thing twice. Each separator lives in
  // the catalogue, so a language can reorder or respell the whole line.
  const work = formatDuration(Math.round(dayCounts.workMinutes));
  const eventsSummary =
    dayCounts.events === 0 &&
    dayCounts.todosTotal === 0 &&
    dayCounts.workMinutes === 0
      ? undefined
      : dayCounts.todosTotal === 0
        ? t("briefing.evening.eventsSummaryNoTodos", {
            events: dayCounts.events,
            work,
          })
        : t("briefing.evening.eventsSummary", {
            events: dayCounts.events,
            todos: `${dayCounts.todosDone}/${dayCounts.todosTotal}`,
            work,
          });
  // No line before the first issue: 「第 0 号」would announce a paper that
  // was never published. The streak half drops out on its own at 0.
  const issueLine =
    eveningIssueNow === null || eveningIssueNow.number === 0
      ? undefined
      : eveningIssueNow.streak === 0
        ? t("briefing.evening.issueNumber", { count: eveningIssueNow.number })
        : t("briefing.evening.issueLine", {
            number: eveningIssueNow.number,
            streak: eveningIssueNow.streak,
          });
  // 「Daily に移動」: the day's Daily through the shell's item intent, or the
  // Daily tab on a host without one. Nothing is written — a day with no
  // daily yet is the Daily side's to create.
  const openDaily = useCallback(() => {
    if (onNavigateToItem === undefined) {
      onNavigate({ section: "materials", tab: "daily" });
      return;
    }
    onNavigateToItem({ id: `daily-${todayKey}`, role: "daily" });
  }, [onNavigateToItem, onNavigate, todayKey]);

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
          focusText={focusDraft}
          onFocusChange={handleFocusChange}
          onFocusBlur={flushFocus}
          todos={remainingTodos}
          onSetTodoStatus={handleSetTodoStatus}
          schedule={upcoming}
          issueLine={issueLine}
          goalMoves={goalMoves}
          events={eveningRows}
          eventsSummary={eventsSummary}
          onSaveEventNote={saveNote}
          tomorrowTodos={tomorrowTodos}
          onPlaceTomorrow={handlePlaceTodoTomorrow}
          onOpenDaily={openDaily}
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
        // The goals note is a SECOND async document, and its fields are
        // editable — offering them before it answers hands the user an empty
        // box over goals that exist, and the keystroke typed there overwrites
        // them once the debounce fires. Same skeleton, one gate.
        loading={loading || goalsLoading || focusLoading}
        data={data}
        labels={labels}
        focusText={todayFocus}
        intentionText={intentionText}
        onIntentionChange={handleIntentionChange}
        onIntentionBlur={flushIntention}
        goals={goals}
        goalLabels={goalLabels}
        onGoalChange={handleGoalChange}
        onGoalBlur={flushGoals}
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
    </>
  );
}
