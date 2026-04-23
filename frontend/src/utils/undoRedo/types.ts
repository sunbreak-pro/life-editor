export type UndoDomain =
  | "taskTree"
  | "daily"
  | "note"
  | "calendar"
  | "routine"
  | "scheduleItem"
  | "playlist"
  | "sound"
  | "settings"
  | "wikiTag"
  | "paper"
  | "database";

export interface UndoCommand {
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
  /** @internal Monotonic sequence number stamped by UndoRedoManager.push() */
  _seq?: number;
}

export const MAX_HISTORY_SIZE = 50;
