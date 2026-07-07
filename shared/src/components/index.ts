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
// Color picker (W-UX) — shared color-change control (presets + custom hex +
// clear). Promoted from the Kanban's KanbanColorControl so folder / tag / any
// future surface reuse one component. Pure presentation (§6.4).
export { ColorPicker, type ColorPickerProps } from "./ColorPicker";
export { BottomSheet, type BottomSheetProps } from "./BottomSheet";
// Lumen shipping primitives (ClaudeDesign port). Pure presentation: lumen-*
// tokens only (§3.1), opaque container surfaces (§3.5), props-injected copy
// (§6). Toast = notification card + fixed stack; Sheet = any-edge drawer;
// Sidebar = grouped nav rows (Lumen selected/mint states); Menu = dropdown.
export {
  Toast,
  ToastViewport,
  type ToastProps,
  type ToastVariant,
  type ToastViewportProps,
  type ToastViewportPosition,
} from "./Toast";
export { Sheet, type SheetProps, type SheetSide } from "./Sheet";
export {
  Sidebar,
  SidebarItem,
  type SidebarProps,
  type SidebarItemProps,
  type SidebarItemTone,
} from "./Sidebar";
export {
  Menu,
  MenuItem,
  type MenuProps,
  type MenuItemProps,
  type MenuItemVariant,
} from "./Menu";
// Master-Detail (W6) — responsive list+detail layout. Pure presentation:
// DataService-free, props-injected copy (§3.1 / §6.4). Selection stays with
// the host section; this primitive only takes detailOpen + onCloseDetail.
export { MasterDetail, type MasterDetailProps } from "./MasterDetail";
// Task detail panel (W7) — the right pane for the selected task in the
// Tasks MasterDetail. Pure presentation: title/status/content with injected
// callbacks + content editor + props-injected copy (§3.1 / §6.4).
export { TaskDetailPanel, type TaskDetailPanelProps } from "./TaskDetailPanel";
// Task detail modal (K3) — full-screen animated modal shell the Kanban opens
// on card click. Pure presentation: host injects the detail surface as
// children + props-injected copy (§3.1 / §6.4).
export { TaskDetailModal, type TaskDetailModalProps } from "./TaskDetailModal";
// Task add dialog (W-UX) — small centered overlay to create a task / folder.
// Pure presentation: host injects folder options + copy, receives create
// intent via onSubmit (§3.1 / §6.4).
export {
  TaskAddDialog,
  type TaskAddDialogProps,
  type TaskAddDialogLabels,
  type TaskAddFolderOption,
  type TaskAddType,
} from "./TaskAddDialog";
// App shell (W5) — responsive single shell + its nav pieces. Pure
// presentation: DataService-free, props-injected i18n (§3.1 / §6.4).
export { NavItem, type NavItemProps, type NavItemTone } from "./NavItem";
export {
  SidebarNav,
  type SidebarNavProps,
  type SidebarNavSection,
  type SidebarNavLabels,
} from "./SidebarNav";
// Header tabs (target-IA Desktop standard) + segmented control (its Mobile
// echo). Pure presentation: props-injected copy, lumen-* tokens (§3.1 / §5).
export { HeaderTabs, type HeaderTabsProps, type HeaderTab } from "./HeaderTabs";
// RightSidebar detail panel (App Shell Turn 2) — push-in Desktop panel +
// left Mobile drawer + open/close toggle + the portal a section uses to push
// its detail UI into the panel. Pure presentation: props-injected copy,
// lumen-* tokens (§3.1 / §5). Requires a RightSidebarProvider (context barrel).
export { RightSidebar, type RightSidebarProps } from "./RightSidebar";
export { MobileDrawer, type MobileDrawerProps } from "./MobileDrawer";
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
} from "./BottomTabBar";
export {
  AppShell,
  type AppShellProps,
  type AppShellSection,
  type AppShellLabels,
  type DetailPanelLabels,
} from "./AppShell";
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
  type ShortcutRow,
} from "./SettingsShortcuts";
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
export {
  AudioChimeBridge,
  type AudioChimeBridgeProps,
} from "./AudioChimeBridge";
// Analytics (W4) — recharts dashboards (Overview/Tasks/Work/Schedule). Pure
// presentational: aggregation is pure, data + t are injected by the web host
// (§6.4). Sub-barrel so the feature can grow exports without touching here.
export * from "./Analytics";
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
