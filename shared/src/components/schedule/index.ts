/*
 * Schedule feature sub-barrel (W8). Exposes the presentational week/day time
 * grid plus the pure layout + local-date helpers the host needs to drive week
 * navigation (mirrors the Connect sub-barrel re-exporting its graph builders).
 * The global components/index.ts re-exports this with `export *`.
 */
export { WeekTimeGrid } from "./WeekTimeGrid";
export type { WeekTimeGridProps, WeekTimeGridItem } from "./WeekTimeGrid";
// Target-IA presentational parts (W8): month grid + day agenda + toolbar +
// event editor + routine summary/editor. Pure presentation (§3.1 / §6.4).
export {
  MonthGrid,
  type MonthGridProps,
  type MonthGridItem,
} from "./MonthGrid";
export {
  AgendaList,
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
} from "./EventEditorPane";
export {
  RoutineSummaryCard,
  type RoutineSummaryCardProps,
  type RoutineSummaryCardLabels,
  type RoutineSummaryRow,
} from "./RoutineSummaryCard";
export {
  RoutineEditorForm,
  type RoutineEditorFormProps,
  type RoutineEditorFormLabels,
  type RoutineEditorRoutine,
  type RoutineEditorGroup,
} from "./RoutineEditorForm";
// #185 Step 2: repeat-settings editor shared between RoutineEditorForm and the
// Event editor's repeat section.
export {
  FrequencyEditor,
  type FrequencyEditorProps,
  type FrequencyEditorLabels,
  type FrequencyEditorValue,
  type FrequencyEditorGroup,
} from "./FrequencyEditor";
// Target-IA rightSidebar frame: 2-tab (Calendar) / 1-tab (Routines) switcher
// the Schedule tabs portal into the shared detail panel.
export {
  ScheduleSidebarTabs,
  type ScheduleSidebarTabsProps,
  type ScheduleSidebarTab,
} from "./ScheduleSidebarTabs";
// A-3 (#298): rightSidebar "Today's Todo" tray — placed / unplaced task groups
// + an "add from tasks" picker. Pure presentation (§3.1 / §6.4).
export {
  TodayTodoTray,
  type TodayTodoTrayProps,
  type TodayTodoTrayLabels,
  type TodayTodoRow,
  type TodayTodoAddableRow,
} from "./TodayTodoTray";
// #223: right-click context menu (rename / duplicate / delete) for a calendar
// item block/chip.
export {
  ScheduleItemContextMenu,
  type ScheduleItemContextMenuProps,
  type ScheduleItemContextMenuLabels,
} from "./ScheduleItemContextMenu";
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
  formatDateKey,
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
