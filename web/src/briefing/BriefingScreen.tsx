import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefingView,
  BriefingVizPanel,
  EveningReflectionPreview,
  EveningView,
  GoalTodoLinkScreen,
  ItemDetailOverlay,
  MorningGoalsBlock,
  PeriodEndReviewCard,
  RightSidebarPortal,
  TodayTodoTray,
  eveningBodyLines,
  eveningDayCounts,
  eveningEvents,
  getDayStartHour,
  goalMarkTitles,
  goalPeriodRanges,
  goalProgressText,
  goalsMovedToday,
  periodStartDateKey,
  todayDateKey,
  tomorrowCandidates,
  useGoalLinkSnapshot,
  useItemPanelOptional,
  useMediaQuery,
  useMinuteClock,
  useSyncDomains,
  useTranslation,
  type BriefingColumn,
  type BriefingTab,
  type DataService,
  type GoalPeriodKind,
  type GoalTodoLinkScreenLabels,
  type ItemPanelOptions,
  type MorningGoalsLabels,
  type WikiTagAssignmentUnified,
  type WikiTagUnified,
  WEEK_STARTS_ON,
  WIDE_QUERY,
} from "@life-editor/shared";
import type { NavDestination } from "../hooks/useShellNavigation";
import { LazyRichTextEditor } from "../notes/LazyRichTextEditor";
import { preloadRichTextEditor } from "../notes/preloadRichTextEditor";
import { attachBriefingTags } from "./hooks/useBriefingAggregation";
import { useBriefingData } from "./hooks/useBriefingData";
import { useDailySections } from "./hooks/useDailySections";
import { useEveningIssue } from "./hooks/useEveningIssue";
import { useEveningNotes } from "./hooks/useEveningNotes";
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
  onOpenGoals,
}: BriefingScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  // Neither paper carries the 宣言 block any more: #2106 took the morning
  // field off, #2107 the evening one at every width (both the wide read-back
  // and the narrow input of #391). The declaration's stored text is untouched.

  const todayKey = todayDateKey();

  const {
    loading,
    data,
    todosRead,
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
      noSchedule: t("briefing.noSchedule"),
      routineTag: t("briefing.routineTag"),
      allDay: t("briefing.allDay"),
      timeColumn: t("briefing.table.time"),
      eventsColumn: t("briefing.table.events"),
      todosColumn: t("briefing.table.todos"),
      untimed: t("briefing.table.untimed"),
      ongoing: t("briefing.table.ongoing"),
      nowLine: t("briefing.table.now"),
      columnSwitch: t("briefing.table.columns"),
      addEvent: t("briefing.table.addEvent"),
      addTodo: t("briefing.table.addTodo"),
      // The month view's own words (#2223 — the same「他 N 件」as #2221).
      moreCount: (count: number) => t("scheduleScreen.moreCount", { count }),
      close: t("common.close"),
      carryoverTitle: t("briefing.carryoverTitle"),
      // The carryover rows draw the shared todo checkbox since #1368, so they
      // name their status with the same words 夕刊 and the Todos section use.
      todoStatus: t("todoDetail.status"),
      statusNotStarted: t("todoDetail.statusNotStarted"),
      statusDone: t("todoDetail.statusDone"),
      edit: t("briefing.edit"),
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
      reflectionTitle: t("briefing.evening.reflectionTitle"),
      // No caption at all on a day with nothing written (#1822) — the same
      // shape the 宣言 caption took (#427): 「保存済み」over an untouched
      // empty field reads as "already done".
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
   * A carryover row's「編集」— open the todo where it lives (#1824).
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

  /*
   * The table's rows and its「+」open Schedule's own editor and creation panel
   * IN PLACE (#2223), through the entry point #2218 built — the reader stays
   * on the paper. Opened from here, the panel offers「予定の画面で開く」, which
   * hands the item to the shell's item intent above.
   *
   * Where no ItemPanel Provider is mounted (a standalone render) a row falls
   * back to opening the item where it lives, and a「+」to the Schedule
   * section, rather than doing nothing.
   */
  const itemPanel = useItemPanelOptional();
  const panelOptions = useMemo<ItemPanelOptions>(
    () => ({
      onOpenInSchedule: (target) =>
        onNavigateToItem === undefined
          ? onNavigate({ section: "schedule" })
          : onNavigateToItem(
              target.date === null
                ? { id: target.id, role: target.role }
                : { id: target.id, role: target.role, date: target.date },
            ),
      onNavigateToItem,
    }),
    [onNavigateToItem, onNavigate],
  );
  const openRow = useCallback(
    (id: string, role: BriefingColumn) => {
      if (itemPanel === null) {
        openItem(id, role);
        return;
      }
      itemPanel.openEdit(
        role === "event" ? { role, id, date: todayKey } : { role, id },
        panelOptions,
      );
    },
    [itemPanel, openItem, panelOptions, todayKey],
  );

  // The clock the table's current-time line and its over / under way marks
  // read, as minutes since 00:00 of the PAPER's day: past midnight on a day
  // that starts late it runs on past 1440 rather than wrapping to 00:xx.
  //
  // Whole days apart × 1440 plus the wall clock, never elapsed milliseconds:
  // on a daylight-saving day those run an hour off the clock the reader sees.
  const { now } = useMinuteClock();
  const daysPast = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(`${todayKey}T00:00:00`).getTime()) /
      86_400_000,
  );
  const nowMinutes = daysPast * 1440 + now.getHours() * 60 + now.getMinutes();

  /*
   * A column's「+」(#2223) — the creation panel on today, starting at the
   * next half hour and running the panel's usual hour. Late in the day the
   * start holds at 23:30 and the end at 23:59, so neither leaves the day.
   *
   * Both columns open the same panel for now: #2218's `openCreate` takes no
   * initial type (ItemCreatePanel keeps it as internal state), so the Todo
   * column's「+」opens on the panel's own default.
   */
  const openCreate = useCallback(() => {
    if (itemPanel === null) {
      onNavigate({ section: "schedule" });
      return;
    }
    const start = Math.min(
      (Math.floor(Math.max(nowMinutes, 0) / 30) + 1) * 30,
      23 * 60 + 30,
    );
    const end = Math.min(start + 60, 23 * 60 + 59);
    const hhmm = (total: number) =>
      `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    itemPanel.openCreate(
      { date: todayKey, start: hhmm(start), end: hhmm(end) },
      panelOptions,
    );
  }, [itemPanel, nowMinutes, onNavigate, panelOptions, todayKey]);

  // Phone layout: the table shows one column at a time (#2223).
  const narrow = !useMediaQuery(WIDE_QUERY, true);

  /*
   * The rows' WikiTags (#2223) — read beside the paper's own fetch, on the
   * same `tags` counter, and joined in by `attachBriefingTags`. Until it
   * lands (or if it fails) the rows simply carry no tag line.
   */
  const tagsVersion = useSyncDomains("tags");
  const [tagRead, setTagRead] = useState<{
    tags: WikiTagUnified[];
    assignments: WikiTagAssignmentUnified[];
  } | null>(null);
  useEffect(() => {
    let alive = true;
    // Through a resolved promise so a host without these reads (a stub)
    // fails into the catch instead of throwing out of the effect.
    Promise.resolve()
      .then(() =>
        Promise.all([ds.listAllWikiTagsUnified(), ds.listAllTagAssignments()]),
      )
      .then(([tags, assignments]) => {
        if (alive) setTagRead({ tags, assignments });
      })
      .catch(() => {
        // No tag line is the honest fallback; the paper itself is unaffected.
      });
    return () => {
      alive = false;
    };
  }, [ds, tagsVersion]);

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
  // Named apart from the morning's `goalState` (useMorningGoals, #2106): that
  // one waits on the todo read and the note migration, this one on 夕刊.
  const eveningGoalState = goalSnapshot.state;
  // null until the goals and links land: the block then shows nothing rather
  // than「今日進んだ目標はありません」, which would be a false "none" that
  // flips to a real row a moment later. A read that FAILED is not pending,
  // though — the block then stays, printing the failure line (noGoals above)
  // instead of vanishing with no sign (#2107 review).
  const goalMoves = useMemo(
    () =>
      eveningGoalState === null
        ? goalsFailed
          ? []
          : null
        : goalsMovedToday({
            goals: eveningGoalState.goals,
            links: eveningGoalState.links,
            todos: data.todoNodes,
            dateKey: todayKey,
            dayStartHour,
          }),
    [eveningGoalState, goalsFailed, data.todoNodes, todayKey, dayStartHour],
  );
  const tomorrowTodos = useMemo(
    () =>
      tomorrowCandidates({
        todos: data.todoNodes,
        goals: eveningGoalState?.goals ?? [],
        links: eveningGoalState?.links ?? [],
        todayKey,
        dayStartHour,
      }),
    [data.todoNodes, eveningGoalState, todayKey, dayStartHour],
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

  // Every width (#609): below 768px the detail panel is a MobileDrawer opened
  // from the hamburger in the 朝刊/夕刊 band, so the tray is reachable there
  // too. <RightSidebarPortal> renders nothing while the panel is closed.
  //
  // 夕刊 only since #2223: the morning paper's table now holds today's todos
  // itself, so「今日の Todo」and its「Todo 一覧」left the morning panel. The
  // component is Schedule's (#298) and stays as it is. Its「+」went with it —
  // that was the morning paper's second way into the creation panel.
  const todoTrayPortal = (
    <RightSidebarPortal>
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-lumen-text">
          {t("briefing.todo.title")}
        </h3>
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
  const paperData = useMemo(() => {
    const withGoals =
      goalState === null
        ? data
        : {
            ...data,
            todos: data.todos.map((todo) => ({
              ...todo,
              goals: goalMarkTitles(goalState, todo.id),
            })),
          };
    return tagRead === null
      ? withGoals
      : attachBriefingTags(withGoals, tagRead.tags, tagRead.assignments);
  }, [data, goalState, tagRead]);

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
        />
      </>
    );
  }

  return (
    <>
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
        onOpenItem={openRow}
        onAddItem={openCreate}
        onJumpToTodos={(id) => openItem(id, "task")}
        nowMinutes={nowMinutes}
        narrow={narrow}
      />
      {goalLinkOverlay}
    </>
  );
}
