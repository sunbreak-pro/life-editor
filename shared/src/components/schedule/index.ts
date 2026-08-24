/*
 * Schedule feature sub-barrel (W8). Exposes the presentational week/day time
 * grid plus the pure layout + local-date helpers the host needs to drive week
 * navigation (mirrors the Connect sub-barrel re-exporting its graph builders).
 * The global components/index.ts re-exports this with `export *`.
 */
// #893 step 3: the one piece of rendering the calendar surfaces genuinely
// shared verbatim, plus the provenance union all three item types name.
export type { ScheduleItemVariant } from "./scheduleVariantVisuals";
export { WeekTimeGrid } from "./WeekTimeGrid";
export type {
  WeekTimeGridProps,
  WeekTimeGridItem,
  // #893: the prop bundles.
  WeekTimeGridData,
  WeekTimeGridLabels,
  WeekTimeGridHandlers,
  WeekTimeGridDisplay,
  WeekTimeGridFormat,
} from "./WeekTimeGrid";
// Target-IA presentational parts (W8): month grid + day agenda + toolbar +
// event editor + routine summary/editor. Pure presentation (§3.1 / §6.4).
export {
  MonthGrid,
  type MonthGridProps,
  type MonthGridItem,
} from "./MonthGrid";
export {
  AgendaList,
  agendaRowHeightPx,
  type AgendaListProps,
  type AgendaListLabels,
  type AgendaItem,
} from "./AgendaList";
export {
  ScheduleToolbar,
  type ScheduleToolbarProps,
  type ScheduleToolbarLabels,
} from "./ScheduleToolbar";
export {
  EventEditorPane,
  type EventEditorPaneProps,
  type EventEditorItem,
  type EventEditorLabels,
  // #893: the prop bundles — handlers / options / repeat section.
  type EventEditorHandlers,
  type EventEditorOptions,
  type EventEditorRepeat,
  // #998: the narrow sheet's Event → Todo entry.
  type EventEditorConvert,
  // #628: the one patch the save button hands the host.
  type EventEditorPatch,
} from "./EventEditorPane";
export {
  RoutineSummaryCard,
  type RoutineSummaryCardProps,
  type RoutineSummaryCardLabels,
  type RoutineSummaryRow,
} from "./RoutineSummaryCard";
// #408: the rightSidebar "繰り返し" tab — reach every routine (incl. ones with
// no occurrence on screen) now that the Routines header tab is retired.
export {
  RepeatListPanel,
  type RepeatListPanelProps,
  type RepeatListPanelLabels,
  type RepeatListRow,
} from "./RepeatListPanel";
// #185 Step 2: the repeat-settings editor inside the Event editor's repeat
// section (it was shared with the Routines tab's form until #408 retired it).
export {
  FrequencyEditor,
  type FrequencyEditorProps,
  type FrequencyEditorLabels,
  type FrequencyEditorValue,
} from "./FrequencyEditor";
// Target-IA rightSidebar frame: the tab switcher the Schedule section portals
// into the shared detail panel (今日の流れ / 本日の Todo / 繰り返し).
export {
  ScheduleSidebarTabs,
  type ScheduleSidebarTabsProps,
  type ScheduleSidebarTab,
} from "./ScheduleSidebarTabs";
// A-3 (#298): rightSidebar "Today's Todo" tray — placed / unplaced todo groups
// + an "add from todos" picker. Pure presentation (§3.1 / §6.4).
export {
  TodayTodoTray,
  type TodayTodoTrayProps,
  type TodayTodoTrayLabels,
  type TodayTodoRow,
  type TodayTodoAddableRow,
} from "./TodayTodoTray";
// #279: this / future / all scope chooser for editing or deleting a
// routine-derived occurrence.
export {
  RepeatScopeDialog,
  type RepeatScopeDialogProps,
  type RepeatScopeDialogLabels,
  type RepeatScope,
} from "./RepeatScopeDialog";
// #280: Mobile FAB quick-capture form (moved from web CalendarTab).
export {
  QuickCaptureSheet,
  type QuickCaptureSheetProps,
  type QuickCaptureLabels,
} from "./QuickCaptureSheet";
// #376: unified creation panel (event / todo tabs, "new" or "place an existing
// todo") backing both the Desktop creation overlay and the Mobile
// QuickCaptureSheet. Supersedes the event-only EventCreateFields (#299).
export {
  ItemCreatePanel,
  type ItemCreatePanelProps,
  type ItemCreatePanelLabels,
  type ItemCreatePanelInitial,
  type ItemCreatePanelPools,
  type ItemCreatePanelHandlers,
  type ItemCreateOption,
  type ItemCreateNoteDraft,
  type ItemCreateSlot,
  type ItemCreateType,
  type ItemCreateSource,
} from "./ItemCreatePanel";
// #940: the all-day switch, shared by the creating and the editing side so
// the control is the same object in both.
export { AllDaySwitch, type AllDaySwitchProps } from "./AllDaySwitch";
// #468: the calendar lens — the single-select chip row under the toolbar that
// narrows the grid to one calendar (#889 lifted it out of CalendarTab).
export {
  CalendarLensRow,
  type CalendarLensRowProps,
  type CalendarLensRowLabels,
} from "./CalendarLensRow";
// #296: the calendar's status surfaces — the loading card, the "could not
// load" card, and the quiet banner for a failed range fetch that still has
// rows under it (#889 lifted them out of CalendarTab).
export {
  ScheduleLoadingCard,
  ScheduleErrorCard,
  ScheduleRangeErrorBanner,
  type ScheduleLoadState,
  type ScheduleLoadErrorLabels,
  type ScheduleLoadingCardProps,
  type ScheduleErrorCardProps,
  type ScheduleRangeErrorBannerProps,
} from "./ScheduleStateCards";
// #222: derived status tag (未着手 / 着手中 / 完了) shown on calendar surfaces
// in place of the round completion checkmark.
export {
  ScheduleStatusTag,
  type ScheduleStatusTagProps,
} from "./ScheduleStatusTag";
export {
  deriveScheduleStatus,
  type ScheduleStatus,
  type DerivableScheduleItem,
} from "../../utils/scheduleStatus";
export {
  layoutDayItems,
  minutesFromMidnight,
  addDaysKey,
  startOfWeekKey,
  weekDayKeys,
  dayOfWeek,
  parseDateKey,
  dateFromKey,
  formatDateKeyFromParts,
  pxToMinutes,
  minutesToPx,
  snapMinutes,
  minutesToTime,
  startOfMonthKey,
  addMonthsKey,
  monthGridKeys,
  DEFAULT_SNAP_MINUTES,
  type GridLayoutItem,
  type PositionedItem,
  type HourRange,
} from "../../utils/scheduleGridLayout";
