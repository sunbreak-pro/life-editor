import type { ShortcutDefinition } from "../types/shortcut";

/*
 * Default keybindings (W1, web-lean). One entry per live web feature; see
 * `types/shortcut.ts` for the selection rationale. descriptionKey points at
 * `settings.shortcutLabels.*` in the shared catalog (resolved by the host
 * via t(), then handed to the SettingsShortcuts primitive as copy).
 */
export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // Global
  {
    id: "global:command-palette",
    category: "global",
    descriptionKey: "settings.shortcutLabels.commandPalette",
    defaultBinding: { code: "KeyK", meta: true },
    activeInInput: true,
  },
  {
    id: "global:settings",
    category: "global",
    descriptionKey: "settings.shortcutLabels.openSettings",
    defaultBinding: { code: "Comma", meta: true },
    activeInInput: true,
  },
  {
    id: "global:new-task",
    category: "global",
    descriptionKey: "settings.shortcutLabels.newTask",
    defaultBinding: { key: "n" },
    activeInInput: false,
  },
  // Navigation — web sections
  {
    id: "nav:tasks",
    category: "navigation",
    descriptionKey: "settings.shortcutLabels.goToTasks",
    defaultBinding: { key: "1", meta: true },
    activeInInput: true,
  },
  {
    id: "nav:daily",
    category: "navigation",
    descriptionKey: "settings.shortcutLabels.goToDaily",
    defaultBinding: { key: "2", meta: true },
    activeInInput: true,
  },
  {
    id: "nav:notes",
    category: "navigation",
    descriptionKey: "settings.shortcutLabels.goToNotes",
    defaultBinding: { key: "3", meta: true },
    activeInInput: true,
  },
  {
    id: "nav:schedule",
    category: "navigation",
    descriptionKey: "settings.shortcutLabels.goToSchedule",
    defaultBinding: { key: "4", meta: true },
    activeInInput: true,
  },
  {
    id: "nav:tags",
    category: "navigation",
    descriptionKey: "settings.shortcutLabels.goToTags",
    defaultBinding: { key: "5", meta: true },
    activeInInput: true,
  },
  // Edit
  {
    id: "edit:undo",
    category: "edit",
    descriptionKey: "settings.shortcutLabels.undo",
    defaultBinding: { code: "KeyZ", meta: true },
    activeInInput: false,
  },
  {
    id: "edit:redo",
    category: "edit",
    descriptionKey: "settings.shortcutLabels.redo",
    defaultBinding: { code: "KeyZ", meta: true, shift: true },
    activeInInput: false,
  },
];
