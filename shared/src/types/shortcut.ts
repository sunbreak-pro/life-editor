/*
 * Shortcut types (W1, web-lean). Selected from the FROZEN
 * `frontend/src/types/shortcut.ts` to ONLY the IDs that map to a real web
 * section/feature (no dead commands). Excluded vs. the Tauri set: the retired
 * REPL panel (§8) / sidebar / right-sidebar / work-timer / play-pause /
 * reset-timer / view toggles / tree nav / calendar nav / tab nav — none of
 * those surfaces exist in the web build. The web `nav:*` IDs are re-keyed to
 * the web MainScreen
 * sections (tasks/daily/notes/schedule/tags), NOT the Tauri section names
 * (schedule/ideas/work/analytics/materials), so every binding is live.
 */
import type { TranslationKey } from "../i18n/resources";

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

/**
 * One settings row's view-model — already-resolved label + accelerator (the
 * host owns `t()`). Lived inside `components/SettingsShortcuts.tsx` until
 * #670 C3 PR 2: three modules and the web Settings screen built these rows,
 * so a display component was not the right home for the shape.
 */
export interface ShortcutRow {
  id: ShortcutId;
  /** Category for grouping (global / navigation / edit). */
  category: ShortcutCategory;
  /** Translated action name. */
  label: string;
  /** Human-readable accelerator (e.g. "⌘ + K"). */
  displayString: string;
  /** True when an override differs from the default. */
  isModified: boolean;
}

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
  /** i18n key resolved by the HOST (props-injected copy, CLAUDE.md §6.4).
   *  Typed as the catalog's key union (#726) — the settings sheet resolves it
   *  through a variable, which nothing else can check. */
  descriptionKey: TranslationKey;
  defaultBinding: KeyBinding;
  activeInInput: boolean;
}

export type ShortcutConfig = Partial<Record<ShortcutId, KeyBinding>>;
