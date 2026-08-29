import { useCallback, useMemo } from "react";
import {
  buildWeekdayLabels,
  dateFromKey,
  useTranslation,
  TOUR_ANCHORS,
  type FrequencyEditorLabels,
  type FrequencyLabelCopy,
  type ItemCreatePanelLabels,
  type ScheduleStatus,
  type SegmentedOption,
  type TodoScheduleSlot,
} from "@life-editor/shared";

/*
 * Schedule copy (#673 / C6) — the i18n label bundles and date formatting the
 * Schedule host feeds into the pure shared parts.
 *
 * Two kinds of thing live here, and the split is the point:
 *
 *   - the DATE formatters are pure `(language, dateKey) -> string`. They were
 *     five `new Intl.DateTimeFormat(...)` sites scattered through a 2,900-line
 *     component, each spelling out its own field set, and the only way to check
 *     one was to look at the screen. Out here a test can state the January /
 *     December edges and the ja↔en difference as facts;
 *   - `useScheduleCopy` collects the `t(...)` bundles. It stays a hook because
 *     the memoization has to sit next to the language that invalidates it, but
 *     it holds no component state, so renderHook can read the whole bundle.
 *
 * Field sets are preserved exactly as CalendarTab spelled them — the labels on
 * screen must not shift (#673 is a behavior-zero refactor). §6.4: the shared
 * parts never build copy; the host hands them finished strings.
 */

/** Numeric month/day — the week-range ends ("8/10 – 8/16"). */
export function formatShortDate(language: string, dateKey: string): string {
  return new Intl.DateTimeFormat(language, {
    month: "numeric",
    day: "numeric",
  }).format(dateFromKey(dateKey));
}

/**
 * Month, day and weekday — "today" in the flow panel, and the month cells'
 * accessible names (MonthGrid otherwise falls back to the raw ISO key, which a
 * screen reader announces as "2026-07-09").
 */
export function formatFullDay(language: string, dateKey: string): string {
  return new Intl.DateTimeFormat(language, {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(dateFromKey(dateKey));
}

/**
 * The same, plus the year (#353). The creation panel can be open on a day the
 * user navigated months — or years — away to, so the year has to be visible.
 */
export function formatLongDate(language: string, dateKey: string): string {
  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(dateFromKey(dateKey));
}

/** Year + month, for the month view's title. */
export function formatMonthTitle(language: string, dateKey: string): string {
  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "long",
  }).format(dateFromKey(dateKey));
}

/** Copy the todo schedule line needs, already translated (§6.4). */
export interface TodoScheduleCopy {
  /** "終日" — the day is claimed whole. */
  allDay: string;
  /** "未設定" — the todo carries no schedule at all. */
  unscheduled: string;
}

/**
 * "When is this todo", for the todo detail panel's read-only row (#877).
 *
 * The YEAR is included for the same reason the creation panel spells it out
 * (#353): the sheet opens from a chip on whatever day the calendar is parked
 * on, and a todo set for next January would otherwise read as this one.
 *
 * A null slot is a todo with no schedule — which is a real answer, not a gap.
 * Saying nothing at all is how the panel got here.
 */
export function formatTodoSchedule(
  language: string,
  slot: TodoScheduleSlot | null,
  copy: TodoScheduleCopy,
): string {
  if (slot == null) return copy.unscheduled;
  const day = formatLongDate(language, slot.date);
  // Same en dash the week range uses, so the two time spans on this screen are
  // punctuated alike.
  return slot.isAllDay
    ? `${day} ${copy.allDay}`
    : `${day} ${slot.startTime} – ${slot.endTime}`;
}

export interface PeriodLabelInput {
  language: string;
  /** The day the calendar is anchored on (YYYY-MM-DD). */
  anchorDate: string;
  /** Effective view. Loosely typed on purpose — the host's `effView` also
   *  carries "list" (narrow), which falls through to the day branch. */
  view: string;
  /** Wide layout — narrow never shows the week range. */
  isWide: boolean;
  weekStart: string;
  weekEnd: string;
}

/**
 * The toolbar's period title. Month names its month, a wide week names its two
 * end days, and everything else (day view, and any week on narrow) names the
 * anchor day in full.
 */
export function formatPeriodLabel({
  language,
  anchorDate,
  view,
  isWide,
  weekStart,
  weekEnd,
}: PeriodLabelInput): string {
  if (view === "month") return formatMonthTitle(language, anchorDate);
  if (isWide && view === "week") {
    return `${formatShortDate(language, weekStart)} – ${formatShortDate(language, weekEnd)}`;
  }
  return formatLongDate(language, anchorDate);
}

export interface ScheduleCopyOptions {
  /** Wide layout — narrow drops the sidebar's Todo tab. */
  isWide: boolean;
  /** The note list failed to load; the picker must not claim "no notes yet". */
  notesError: boolean;
}

export interface ScheduleCopy {
  /** Weekday names indexed 0 (Sun) – 6 (Sat). */
  weekdayLabels: string[];
  freqCopy: FrequencyLabelCopy;
  desktopViewOptions: SegmentedOption[];
  toolbarLabels: {
    today: string;
    prev: string;
    next: string;
    openSettings: string;
    view: string;
  };
  sidebarTabs: { id: string; label: string; tourId?: string }[];
  repeatLabels: FrequencyEditorLabels;
  statusLabels: Record<ScheduleStatus, string>;
  createPanelLabels: ItemCreatePanelLabels;
  /** "1時間30分" for a minute count (#553 — the end-time duration suffix). */
  formatDuration: (minutes: number) => string;
  /** "空き 1時間30分" for a gap in the Mobile Dayflow (#691). */
  formatGapLabel: (minutes: number) => string;
}

export function useScheduleCopy({
  notesError,
}: ScheduleCopyOptions): ScheduleCopy {
  const { t } = useTranslation();

  const weekdayLabels = useMemo(() => buildWeekdayLabels(t), [t]);
  const freqCopy = useMemo<FrequencyLabelCopy>(
    () => ({
      daily: t("scheduleScreen.frequencyDaily"),
      weekdaysFallback: t("scheduleScreen.frequencyWeekdays"),
      intervalEvery: t("scheduleScreen.intervalEvery"),
      intervalDays: t("scheduleScreen.intervalDays"),
    }),
    [t],
  );

  const desktopViewOptions = useMemo<SegmentedOption[]>(
    () => [
      { id: "day", label: t("scheduleScreen.viewDay") },
      { id: "week", label: t("scheduleScreen.viewWeek") },
      { id: "month", label: t("scheduleScreen.viewMonth") },
    ],
    [t],
  );

  const toolbarLabels = useMemo(
    () => ({
      today: t("scheduleScreen.today"),
      prev: t("scheduleScreen.prev"),
      next: t("scheduleScreen.next"),
      openSettings: t("scheduleScreen.openSettings"),
      view: t("scheduleScreen.viewLabel"),
    }),
    [t],
  );

  /*
   * The same three tabs at both widths since #1153.
   *
   * Narrow used to get two: the Todo tab was Desktop-only because the phone
   * reached its todos through the section's own Todo tab instead. That tab is
   * retired, so withholding this one would leave narrow with no route to a
   * todo at all — which is a removal, not the reduction the Issue asked for.
   */
  const sidebarTabs = useMemo(
    () => [
      { id: "flow", label: t("scheduleScreen.todayFlow") },
      {
        id: "todo",
        label: t("scheduleScreen.tabTodo"),
        // #1124: the tour points here to open the todos. It used to point at
        // the section's own Todo tab, which #1153 retired along with the board
        // behind it — this switcher is the route now. Only this segment
        // carries an id: the tour has no step on 今日の流れ or 繰り返し, and an
        // anchor nothing asks for is a selector waiting to be misread.
        tourId: TOUR_ANCHORS.scheduleTodoTab,
      },
      { id: "repeats", label: t("scheduleScreen.tabRepeats") },
    ],
    [t],
  );

  const repeatLabels = useMemo<FrequencyEditorLabels>(
    () => ({
      frequency: t("scheduleScreen.frequency"),
      frequencyNone: t("scheduleScreen.frequencyNone"),
      frequencyDaily: t("scheduleScreen.frequencyDaily"),
      frequencyWeekdays: t("scheduleScreen.frequencyWeekdays"),
      frequencyInterval: t("scheduleScreen.frequencyInterval"),
      intervalEvery: t("scheduleScreen.intervalEvery"),
      intervalDays: t("scheduleScreen.intervalDays"),
      startDate: t("scheduleScreen.startDate"),
      converting: t("scheduleScreen.repeatConverting"),
    }),
    [t],
  );

  const statusLabels = useMemo<Record<ScheduleStatus, string>>(
    () => ({
      notStarted: t("scheduleScreen.statusNotStarted"),
      inProgress: t("scheduleScreen.statusInProgress"),
      done: t("scheduleScreen.statusDone"),
    }),
    [t],
  );

  // #376: one label bundle for BOTH creation frames (Desktop overlay + Mobile
  // sheet) — they render the same panel, so keeping two literals here is how
  // the two would eventually drift apart.
  const createPanelLabels = useMemo<ItemCreatePanelLabels>(
    () => ({
      typeLabel: t("scheduleScreen.itemTypeLabel"),
      typeEvent: t("scheduleScreen.typeEvent"),
      typeTodo: t("scheduleScreen.typeTodo"),
      typeNote: t("scheduleScreen.typeNote"),
      title: t("scheduleScreen.title"),
      eventPlaceholder: t("scheduleScreen.quickAddPlaceholder"),
      todoPlaceholder: t("scheduleScreen.todoPlaceholder"),
      date: t("scheduleScreen.date"),
      // #940: the same key the detail editor's switch uses, because it is the
      // same switch — a second phrasing here would make "all day" read as two
      // different settings between creating and editing.
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
      // Same sentence as the tray's picker, and the same fact ("nothing left
      // to schedule") — one key rather than two that can disagree.
      todoPickerEmpty: t("scheduleScreen.todoEmptyAddable"),
      todoPickerNoMatch: t("scheduleScreen.todoPickerNoMatch"),
      noteTitleLabel: t("scheduleScreen.noteTitleLabel"),
      notePlaceholder: t("scheduleScreen.notePlaceholder"),
      searchNotes: t("scheduleScreen.searchNotes"),
      // "No notes yet" is a claim about the user's data, so it must not stand
      // in for a list we simply failed to read.
      notePickerEmpty: notesError
        ? t("scheduleScreen.notePickerError")
        : t("scheduleScreen.notePickerEmpty"),
      notePickerNoMatch: t("scheduleScreen.notePickerNoMatch"),
      noteLinkHint: t("scheduleScreen.noteLinkHint"),
      attachedNote: t("scheduleScreen.attachedNote"),
      clearNote: t("scheduleScreen.clearNote"),
    }),
    [t, notesError],
  );

  // #553: duration suffix on the TimeRangeField's end options ("10:30
  // (1時間30分)"). Hour/minute composition happens here so the words stay in
  // the catalogs — the shared field never builds copy.
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

  // #691: the Mobile Dayflow calls out stretches with nothing in them. The
  // words stay in the catalogs; AgendaList only receives the finished string.
  const formatGapLabel = useCallback(
    (minutes: number) =>
      t("scheduleScreen.freeGap", { duration: formatDuration(minutes) }),
    [t, formatDuration],
  );

  return {
    weekdayLabels,
    freqCopy,
    desktopViewOptions,
    toolbarLabels,
    sidebarTabs,
    repeatLabels,
    statusLabels,
    createPanelLabels,
    formatDuration,
    formatGapLabel,
  };
}
