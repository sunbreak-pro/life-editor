/*
 * Shortcut types (W1, web-lean). Selected from the FROZEN
 * `frontend/src/types/shortcut.ts` to ONLY the IDs that map to a real web
 * section/feature (no dead commands). Excluded vs. the Tauri set: terminal /
 * sidebar / right-sidebar / work-timer / play-pause / reset-timer / view
 * toggles / tree nav / calendar nav / tab nav — none of those surfaces exist
 * in the web build. The web `nav:*` IDs are re-keyed to the web MainScreen
 * sections (tasks/daily/notes/schedule/tags), NOT the Tauri section names
 * (schedule/ideas/work/analytics/materials), so every binding is live.
 */
export type ShortcutId =
  // Global
  | "global:command-palette"
  | "global:settings"
  | "global:new-task"
  // Navigation — web MainScreen sections (see MainScreen.tsx `Section`)
  | "nav:tasks"
  | "nav:daily"
  | "nav:notes"
  | "nav:schedule"
  | "nav:tags"
  // Edit (task tree undo/redo)
  | "edit:undo"
  | "edit:redo";

export type ShortcutCategory = "global" | "navigation" | "edit";

export interface KeyBinding {
  key?: string;
  code?: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface ShortcutDefinition {
  id: ShortcutId;
  category: ShortcutCategory;
  /** i18n key resolved by the HOST (props-injected copy, CLAUDE.md §6.4). */
  descriptionKey: string;
  defaultBinding: KeyBinding;
  activeInInput: boolean;
}

export type ShortcutConfig = Partial<Record<ShortcutId, KeyBinding>>;
