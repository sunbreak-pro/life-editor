export type ShortcutId =
  // Global
  | "global:command-palette"
  | "global:settings"
  | "global:work-timer"
  | "global:play-pause"
  | "global:new-task"
  | "global:reset-timer"
  // Navigation
  | "nav:tasks"
  | "nav:memo"
  | "nav:work"
  | "nav:analytics"
  // View
  | "view:toggle-sidebar"
  | "view:toggle-terminal"
  // Task Tree (readonly)
  | "tree:move-up"
  | "tree:move-down"
  | "tree:expand"
  | "tree:collapse"
  | "tree:toggle-complete"
  | "tree:indent"
  | "tree:outdent"
  // Edit (readonly)
  | "edit:undo"
  | "edit:redo"
  // Terminal (readonly)
  | "terminal:new-pane"
  | "terminal:close-pane"
  | "terminal:split-vertical"
  | "terminal:split-horizontal"
  // Calendar
  | "cal:next"
  | "cal:prev"
  | "cal:today"
  | "cal:toggle-view";

export type ShortcutCategory =
  | "global"
  | "navigation"
  | "view"
  | "taskTree"
  | "edit"
  | "terminal"
  | "calendar";

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
  descriptionKey: string;
  defaultBinding: KeyBinding;
  activeInInput: boolean;
  readonly?: boolean;
}

export type ShortcutConfig = Partial<Record<ShortcutId, KeyBinding>>;
