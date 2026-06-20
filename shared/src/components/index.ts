/*
 * Design-system component barrel (W0-3). All cross-platform UI primitives
 * are re-exported from here, and surfaced to hosts via shared/src/index.ts.
 *
 * Conventions (CLAUDE.md §6): notion-* tokens only, opaque container
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
export { BottomSheet, type BottomSheetProps } from "./BottomSheet";
// Master-Detail (W6) — responsive list+detail layout. Pure presentation:
// DataService-free, props-injected copy (§3.1 / §6.4). Selection stays with
// the host section; this primitive only takes detailOpen + onCloseDetail.
export { MasterDetail, type MasterDetailProps } from "./MasterDetail";
// Task detail panel (W7) — the right pane for the selected task in the
// Tasks MasterDetail. Pure presentation: title/status/content with injected
// callbacks + content editor + props-injected copy (§3.1 / §6.4).
export {
  TaskDetailPanel,
  type TaskDetailPanelProps,
} from "./TaskDetailPanel";
// App shell (W5) — responsive single shell + its nav pieces. Pure
// presentation: DataService-free, props-injected i18n (§3.1 / §6.4).
export { NavItem, type NavItemProps } from "./NavItem";
export {
  SidebarNav,
  type SidebarNavProps,
  type SidebarNavSection,
  type SidebarNavLabels,
} from "./SidebarNav";
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
// Work / Pomodoro (W3-B) — pure timer face + task selector + settings editor.
export {
  PomodoroTimer,
  type PomodoroTimerProps,
  type PomodoroTimerLabels,
  type PomodoroPhase,
} from "./PomodoroTimer";
export {
  PomodoroTaskSelector,
  type PomodoroTaskSelectorProps,
  type PomodoroTaskSelectorLabels,
  type TaskOption,
} from "./PomodoroTaskSelector";
export {
  PomodoroSettings,
  type PomodoroSettingsProps,
  type PomodoroSettingsLabels,
  type PomodoroPresetOption,
} from "./PomodoroSettings";
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
