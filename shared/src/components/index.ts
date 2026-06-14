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
