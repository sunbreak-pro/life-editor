/*
 * Design-system component barrel (W0-3). All cross-platform UI primitives
 * are re-exported from here, and surfaced to hosts via shared/src/index.ts.
 *
 * Conventions (CLAUDE.md §6): lumen-* tokens only, opaque container
 * backgrounds (§5), props-injected i18n + DataService (no useTranslation
 * / getDataService inside these primitives, §6.4).
 */
export { cn, type ClassValue } from "./cn";
export {
  Button,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from "./Button";
export {
  IconButton,
  type IconButtonProps,
  type IconButtonVariant,
  type IconButtonSize,
} from "./IconButton";
export { Input, type InputProps } from "./Input";
export { Card, type CardProps } from "./Card";
export { Modal, type ModalProps } from "./Modal";
// In-app confirm / acknowledge dialog (#707) — the replacement for the
// browser's own confirm / alert, which draw outside the theme and freeze the
// page. `useConfirmDialog` turns it into an awaitable question. Since #781 it
// is the ONLY way this app asks (no native dialog is left in shared/ or web/).
export {
  ConfirmDialog,
  useConfirmDialog,
  type ConfirmDialogProps,
  type ConfirmDialogController,
  type ConfirmRequest,
} from "./ConfirmDialog";
// Item operation panels (Issue #307) — the generic Popover / DetailOverlay
// set + declarative ItemAction vocabulary. Any section reuses them for item
// operations; #551 unified left/right click on the popover and retired the
// separate ContextMenu.
export {
  ItemActionPopover,
  type ItemActionPopoverProps,
  ItemDetailOverlay,
  type ItemDetailOverlayProps,
  ItemActionRow,
  type ItemActionRowProps,
  ITEM_ACTION_ROW_CLASS,
  useFloatingDismiss,
  clampToViewport,
  type ItemAction,
  type ItemActionInlineInput,
} from "./itemActions";
// UndoRedo header controls (Issue #304) — the undo/redo icon button pair.
// Pure presentation; the host injects can-flags / handlers / labels.
export { UndoRedoButtons, type UndoRedoButtonsProps } from "./UndoRedoButtons";
// Header command-palette trigger (Issue #306) — input-styled search field that
// opens the CommandPalette overlay; collapses to an icon button on narrow.
export {
  CommandSearchField,
  type CommandSearchFieldProps,
} from "./CommandSearchField";
// Color picker (W-UX) — shared color-change control (presets + custom hex +
// clear). Promoted from the Kanban's KanbanColorControl so folder / tag / any
// future surface reuse one component. Pure presentation (§6.4).
export { ColorPicker, type ColorPickerProps } from "./ColorPicker";
// Time-range editor (#553) — the app-original start–end combo pair (typed
// entry + snapped option lists + duration annotations). Owns the range
// invariant; reusable by any screen that edits a time range.
export {
  TimeRangeField,
  parseTimeInput,
  type TimeRangeFieldProps,
  type TimeRangeFieldLabels,
  type TimeRangeValue,
} from "./TimeRangeField";
export { BottomSheet, type BottomSheetProps } from "./BottomSheet";
// Lumen shipping primitives (ClaudeDesign port). Pure presentation: lumen-*
// tokens only (§3.1), opaque container surfaces (§3.5), props-injected copy
// (§6). Toast = notification card + fixed stack; Menu = dropdown. (The legacy
// Sheet drawer + Sidebar nav rows were retired in the app-integration cleanup
// — BottomSheet / MobileDrawer + SidebarNav are the live surfaces.)
export {
  Toast,
  ToastViewport,
  type ToastProps,
  type ToastVariant,
  type ToastViewportProps,
  type ToastViewportPosition,
} from "./Toast";
export {
  Menu,
  MenuItem,
  type MenuProps,
  type MenuItemProps,
  type MenuItemVariant,
} from "./Menu";
// Task detail panel (W7) — the selected task's detail, shown in the shared
// rightSidebar by the Kanban host. Pure presentation: title/status/content with injected
// callbacks + content editor + props-injected copy (§3.1 / §6.4).
export {
  TaskDetailPanel,
  type TaskDetailPanelProps,
  type TaskDetailPatch,
} from "./TaskDetailPanel";
export {
  TaskStatusChoices,
  type TaskStatusChoicesProps,
} from "./TaskStatusChoices";
// The list-row half of the same idea (#796): one button cycling through the
// three statuses, for rows with no width for the full picker.
export {
  TaskStatusCycleButton,
  nextTaskStatus,
  type TaskStatusCycleButtonProps,
} from "./TaskStatusCycleButton";
// Task add dialog (W-UX) — small centered overlay to create a task. Pure
// presentation: host injects copy, receives create intent via onSubmit
// (§3.1 / §6.4).
export {
  TaskAddDialog,
  type TaskAddDialogProps,
  type TaskAddDialogLabels,
  type TaskAddType,
} from "./TaskAddDialog";
// App shell (W5) — responsive single shell + its nav pieces. Pure
// presentation: DataService-free, props-injected i18n (§3.1 / §6.4).
export { NavItem, type NavItemProps, type NavItemTone } from "./NavItem";
// Live Work-row timer line (#550) — a TimerContext bridge the host injects as
// the Work section's `sublabel` (renders nothing while the timer is idle).
export { NavTimerStatus } from "./NavTimerStatus";
export {
  SidebarNav,
  type SidebarNavProps,
  type SidebarNavSection,
  type SidebarNavLabels,
} from "./SidebarNav";
// Header tabs (target-IA Desktop standard) + segmented control (its Mobile
// echo). Pure presentation: props-injected copy, lumen-* tokens (§3.1 / §5).
export { HeaderTabs, type HeaderTabsProps, type HeaderTab } from "./HeaderTabs";
// Standard section header row (Layout Standard v2 §1) — title-or-tab-band
// left, rightSidebar toggle right, full-width divider below. Mounted in
// AppShell's `header` slot (wide layout).
export { SectionHeader, type SectionHeaderProps } from "./SectionHeader";
// RightSidebar detail panel (App Shell Turn 2) — push-in Desktop panel +
// left Mobile drawer + open/close toggle + the portal a section uses to push
// its detail UI into the panel. Pure presentation: props-injected copy,
// lumen-* tokens (§3.1 / §5). Requires a RightSidebarProvider (context barrel).
export { RightSidebar, type RightSidebarProps } from "./RightSidebar";
export { MobileDrawer, type MobileDrawerProps } from "./MobileDrawer";
// The single placement definition for the narrow layout's floating "+" (#632).
export { MobileFab, type MobileFabProps } from "./MobileFab";
export {
  RightSidebarToggle,
  type RightSidebarToggleProps,
  type RightSidebarToggleVariant,
} from "./RightSidebarToggle";
export {
  RightSidebarPortal,
  type RightSidebarPortalProps,
} from "./RightSidebarPortal";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from "./SegmentedControl";
export {
  BottomTabBar,
  type BottomTabBarProps,
  type BottomTabBarLabels,
  type BottomTabSection,
  BottomTabActionRow,
  type BottomTabActionRowProps,
} from "./BottomTabBar";
export {
  AppShell,
  type AppShellProps,
  type AppShellSection,
  type AppShellLabels,
  type DetailPanelLabels,
} from "./AppShell";
// Page container (Layout Standard v1, Issue #180) — the single owner of a
// section's content width + page gutter. reading/data centered columns or a
// fluid full-bleed passthrough, with a full-width header slot for tab bands.
// Pure presentation: DataService-free, no i18n (§3.1 / §6.4).
export {
  PageContainer,
  type PageContainerProps,
  type PageContainerWidth,
} from "./PageContainer";
// Auth (target-IA D8) — shell-independent pre-login entry card + its two
// field-level parts. SegmentedToggle is the *form-mode* sibling of the
// shell-owned SegmentedControl (radiogroup vs tablist — see each file's
// header comment). Pure presentation: copy + submit intent injected by the
// host (§3.1 / §6.4); the host owns the signIn/signUp calls.
export {
  AuthCard,
  type AuthCardProps,
  type AuthCardLabels,
  type AuthMode,
} from "./AuthCard";
export {
  PasswordField,
  type PasswordFieldProps,
  type PasswordFieldLabels,
} from "./PasswordField";
export {
  SegmentedToggle,
  type SegmentedToggleProps,
  type SegmentedToggleOption,
} from "./SegmentedToggle";
export {
  SettingsAppearance,
  type SettingsAppearanceProps,
} from "./SettingsAppearance";
export {
  SettingsLanguage,
  type SettingsLanguageProps,
} from "./SettingsLanguage";
export {
  SettingsShortcuts,
  type SettingsShortcutsProps,
  type SettingsShortcutsLabels,
} from "./SettingsShortcuts";
// Settings §216 (lightweight prefs) — General (startup section), Reset (clear
// local prefs), and the reusable labeled 3-way Segment. Pure presentation,
// lumen-* tokens, props-injected copy (§3.1 / §6.4).
export {
  SettingsGeneral,
  type SettingsGeneralProps,
  type SettingsGeneralOption,
} from "./SettingsGeneral";
export { SettingsReset, type SettingsResetProps } from "./SettingsReset";
// Day-start hour card (#373) — the write side of the #218 rollover pref.
export {
  SettingsDayStart,
  type SettingsDayStartProps,
} from "./SettingsDayStart";
export {
  SettingsSegment,
  type SettingsSegmentProps,
  type SettingsSegmentOption,
} from "./SettingsSegment";
// Settings building blocks (ClaudeDesign port). Pure presentation, lumen-*
// tokens, props-injected copy (§3.1 / §6.4).
export {
  ThemePreviewCard,
  type ThemePreviewCardProps,
  type ThemePreview,
} from "./ThemePreviewCard";
export { SteppedSlider, type SteppedSliderProps } from "./SteppedSlider";
export {
  ShortcutEditModal,
  type ShortcutEditModalProps,
  type ShortcutEditModalLabels,
} from "./ShortcutEditModal";
// Tag edit modal (#310, globalized in #409) — add/rename/delete/icon/color a
// wiki_tag with usage counts, plus an expandable per-tag item list with
// unassign. Pure presentational: DataService callbacks + labels injected
// (§6.4). `tagIcon` resolves lucide names for the picker (and #311 tag
// headings).
export {
  TagEditModal,
  type TagEditModalProps,
  type TagEditModalLabels,
  type TagEditRow,
  type TagEditItem,
} from "./TagEditModal";
export { resolveTagIcon, TAG_ICON_CHOICES } from "./tagIcon";
// Item-kind display contract (#409) — the SSOT for how a cross-role item list
// announces what each row is. Shared with #412's item-side tag picker so both
// speak one visual language.
export { ItemRoleBadge, type ItemRoleBadgeProps } from "./items/ItemRoleBadge";
export {
  ITEM_ROLE_ORDER,
  ITEM_ROLE_ICON,
  ITEM_ROLE_ICON_CLASS,
  UNKNOWN_ITEM_ROLE_ICON,
  UNKNOWN_ITEM_ROLE_ICON_CLASS,
  resolveItemRole,
  itemRoleLabel,
  itemRoleSortKey,
  type ItemRole,
  type ItemRoleLabels,
} from "./items/itemRole";
export { TagHeadingIcon, type TagHeadingIconProps } from "./TagHeadingIcon";
export {
  SettingsDetailPanel,
  type SettingsDetailPanelProps,
  type SettingsDetailTip,
  type SettingsDetailTask,
} from "./SettingsDetailPanel";
export {
  CommandPalette,
  type CommandPaletteProps,
  type Command,
} from "./CommandPalette";
export {
  TrashView,
  type TrashViewProps,
  type TrashViewLabels,
  type TrashGroup,
  type TrashItem,
  type TrashCategory,
  type TrashBusy,
  type TrashBusyAction,
} from "./TrashView";
// Work / Pomodoro (target-IA import) — pure timer face + phase badge + session
// dots + task selector/sheet + settings editor + completion modal.
export {
  PhaseBadge,
  type PhaseBadgeProps,
  type PomodoroPhase,
} from "./PhaseBadge";
export { SessionDots, type SessionDotsProps } from "./SessionDots";
export {
  PomodoroTimer,
  type PomodoroTimerProps,
  type PomodoroTimerLabels,
} from "./PomodoroTimer";
export {
  PomodoroTaskSelector,
  type PomodoroTaskSelectorProps,
  type PomodoroTaskSelectorLabels,
  type TaskOption,
} from "./PomodoroTaskSelector";
export {
  PomodoroTaskSheet,
  type PomodoroTaskSheetProps,
  type PomodoroTaskSheetLabels,
} from "./PomodoroTaskSheet";
export {
  PomodoroSettings,
  type PomodoroSettingsProps,
  type PomodoroSettingsLabels,
  type PomodoroPresetOption,
  // #714: the patch the save button hands the host + what a preset captures.
  type PomodoroSettingsPatch,
  type PomodoroPresetValues,
} from "./PomodoroSettings";
export {
  SessionCompletionModal,
  type SessionCompletionModalProps,
  type SessionCompletionModalLabels,
} from "./SessionCompletionModal";
// Audio (W3-C) — ambient mixer primitive + headless completion-chime bridge.
export {
  AudioMixer,
  type AudioMixerProps,
  type AudioMixerSound,
  type AudioMixerLabels,
} from "./AudioMixer";
// AudioChimeBridge (W3-C) was retired in #676 (c): it existed only to carry
// playCompletionChime BACKWARDS through the Provider chain, and Audio now sits
// outside Timer so the Timer reads the chime directly (web/src/TimerHost.tsx).
// Analytics (W4) — recharts dashboards (Overview/Tasks/Work/Schedule). Pure
// presentational: aggregation is pure, data + t are injected by the web host
// (§6.4). Sub-barrel so the feature can grow exports without touching here.
export * from "./Analytics";
// Briefing (Briefing plan Step 1) — the morning-paper home surface. Pure
// presentational: the host fetches/aggregates (today's schedule + tasks +
// sessions + the daily's Briefing section) and injects data + labels (§6.4).
// Reuses the 3 adopted Analytics widgets internally (Analytics shrink).
export * from "./briefing";
// Connect (W4) — Canvas 2D + d3-force node graph + backlink view over the
// unified item-link model (listAllTagConnections / listLinksToItem). Pure
// presentational: data + t injected (§6.4). Legacy note_links are NOT used.
export * from "./Connect";
// Schedule (W8) — week/day time grid primitive + pure layout/date helpers.
// Pure presentation: items + already-translated labels injected by the host
// (§6.4). The schedule_items CRUD + RoutineScheduleSync stay host-side.
export * from "./schedule";
// Kanban (K1) — Tasks board primitives (card / column / board) + pure
// column builders. Pure presentational: the host maps TaskNode[] →
// columns and injects copy (§6.4). Folder + Status views; Tag view is K2.
export * from "./Kanban";
// Empty state + skeleton (Materials mini-plan Step 1) — the brief-standard
// blank/loading states (icon+message+accent CTA stack / same-shape pulse
// rows, no spinners). Pure presentation: props-injected copy, lumen-* tokens
// (§3.1 / §5).
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { SkeletonList, type SkeletonListProps } from "./SkeletonList";
// Materials primitives (mini-plan Step 1) — StatusFilterChips / ExcerptListItem
// / DateStrip / QuickAddSheet for the 4-tab Materials views. Sub-barrel so the
// feature can grow exports without touching here (matches Analytics/Connect).
export * from "./materials";
// Notes (life-tags unification S1) — pure tag-heading grouping (buildTagGroups)
// for the Notes side list. UI-free: the interactive list + DnD stay host-side.
export * from "./notes";
