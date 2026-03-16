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
  | "nav:schedule"
  | "nav:ideas"
  | "nav:work"
  | "nav:analytics"
  // View
  | "view:toggle-sidebar"
  | "view:toggle-terminal"
  | "view:toggle-right-sidebar"
  // Task Tree
  | "tree:move-up"
  | "tree:move-down"
  | "tree:expand"
  | "tree:collapse"
  | "tree:toggle-complete"
  | "tree:indent"
  | "tree:outdent"
  // Edit
  | "edit:undo"
  | "edit:redo"
  // Terminal
  | "terminal:new-tab"
  | "terminal:close-pane"
  | "terminal:split-vertical"
  | "terminal:split-horizontal"
  // Tab / Sidebar navigation
  | "tab:next"
  | "tab:prev"
  | "sidebar:item-down"
  | "sidebar:item-up"
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
}

export type ShortcutConfig = Partial<Record<ShortcutId, KeyBinding>>;
