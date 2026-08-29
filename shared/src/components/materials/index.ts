/*
 * Materials sub-barrel (mini-plan Step 1). Pure-presentation primitives for
 * the Materials tab views (Todos / Notes / Daily). lumen-* tokens
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
export { QuickAddSheet, type QuickAddSheetProps } from "./QuickAddSheet";
export { NoteDetailPanel, type NoteDetailPanelProps } from "./NoteDetailPanel";
// The "registered as a template" confirmation (#1179) — name field + where
// the new template now lives.
export {
  TemplateSavedPanel,
  type TemplateSavedPanelProps,
  type TemplateSavedPanelLabels,
} from "./TemplateSavedPanel";
// The saved-templates disclosure in the Notes rightSidebar + the centre panel
// that edits one (#1180).
export {
  TemplateListPanel,
  type TemplateListPanelProps,
  type TemplateListPanelLabels,
  type TemplateListItem,
} from "./TemplateListPanel";
export {
  TemplateEditPanel,
  type TemplateEditPanelProps,
  type TemplateEditPanelLabels,
} from "./TemplateEditPanel";
// The body-only password lock both note surfaces share (#526).
export { LockedBodyGate, type LockedBodyGateProps } from "./LockedBodyGate";
export {
  DailyEntriesPanel,
  type DailyEntriesPanelProps,
  type DailyEntriesPanelEntry,
} from "./DailyEntriesPanel";
// 夕刊カテゴリ (#1046) — the evening block under the Daily body editor.
export {
  DailyEveningCard,
  type DailyEveningCardProps,
  type DailyEveningCardLabels,
  type DailyEveningScheduleEntry,
} from "./DailyEveningCard";
export {
  plainTextToTipTapDoc,
  dailyContentToEditorContent,
  dailyContentExcerpt,
  dailyContentHasRenderedContent,
  type TipTapDoc,
} from "./dailyContent";
// Sidebar list controls (#283) — compact sort + optional-filter header row for
// the Materials rightSidebar lists (Notes / Daily). Pure presentation.
export {
  SidebarListControls,
  type SidebarListControlsProps,
  type SidebarSortMode,
  type SidebarSortDirection,
} from "./SidebarListControls";
// The filter row on its own (#368) — for surfaces that narrow a list by name
// without offering sort (the tag master list).
export {
  SidebarFilterField,
  type SidebarFilterFieldProps,
  type SidebarFilterConfig,
} from "./SidebarFilterField";
