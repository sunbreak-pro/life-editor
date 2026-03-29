export type UndoDomain =
  | "taskTree"
  | "memo"
  | "note"
  | "calendar"
  | "routine"
  | "scheduleItem"
  | "playlist"
  | "sound"
  | "settings"
  | "wikiTag"
  | "paper";

export interface UndoCommand {
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

export const MAX_HISTORY_SIZE = 50;
