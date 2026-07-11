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
// Master-Detail (W6) — responsive list+detail layout. Pure presentation:
// DataService-free, props-injected copy (§3.1 / §6.4). Selection stays with
// the host section; this primitive only takes detailOpen + onCloseDetail.
export { MasterDetail, type MasterDetailProps } from "./MasterDetail";
// Task detail panel (W7) — the right pane for the selected task in the
// Tasks MasterDetail. Pure presentation: title/status/content with injected
// callbacks + content editor + props-injected copy (§3.1 / §6.4).
export { TaskDetailPanel, type TaskDetailPanelProps } from "./TaskDetailPanel";
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
  type ShortcutRow,
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
