/*
 * Materials sub-barrel (mini-plan Step 1). Pure-presentation primitives for
 * the Materials 4-tab views (Tasks / Notes / Daily / Tags). lumen-* tokens
 * only, opaque surfaces, props-injected copy — no useTranslation /
 * getDataService inside (§6.4). Sub-barrel so the feature can grow exports
 * without touching the top-level component barrel.
 */
export {
  StatusFilterChips,
  type StatusFilterChipsProps,
  type StatusFilterChip,
} from "./StatusFilterChips";
export { ExcerptListItem, type ExcerptListItemProps } from "./ExcerptListItem";
export {
  TaskListPanel,
  type TaskListPanelProps,
  type TaskListPanelLabels,
} from "./TaskListPanel";
export { DateStrip, type DateStripProps, type DateStripDay } from "./DateStrip";
export { QuickAddSheet, type QuickAddSheetProps } from "./QuickAddSheet";
export { NoteDetailPanel, type NoteDetailPanelProps } from "./NoteDetailPanel";
export {
  DailyEntriesPanel,
  type DailyEntriesPanelProps,
  type DailyEntriesPanelEntry,
} from "./DailyEntriesPanel";
export {
  plainTextToTipTapDoc,
  dailyContentToEditorContent,
  dailyContentExcerpt,
  type TipTapDoc,
} from "./dailyContent";
export {
  TagGroupsPanel,
  type TagGroupsPanelProps,
  type TagGroupsPanelGroup,
  type TagGroupsPanelMember,
} from "./TagGroupsPanel";
// Sidebar list controls (#283) — compact sort + optional-filter header row for
// the Materials rightSidebar lists (Notes / Daily). Pure presentation.
export {
  SidebarListControls,
  type SidebarListControlsProps,
  type SidebarSortMode,
  type SidebarSortDirection,
  type SidebarFilterConfig,
} from "./SidebarListControls";
