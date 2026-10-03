/**
 * life-tags retirement (#375, the Notes-side follow-up to S3 #225): the
 * "folder" note type is gone — grouping is a life-tag now (buildTagGroups).
 * The union stays a named single-member type so the mapper / payload row keep
 * a name for the column, and so re-widening it stays a one-line change.
 * Legacy `note_type = 'folder'` rows still exist in the DB (rollback safety);
 * they are excluded at fetch time — see `isLegacyNoteFolderRow`.
 */
/**
 * #1047 re-widened it, exactly the "one-line change" the note above predicted:
 * a note TEMPLATE is a note you have not written yet — a name and a body — so
 * it is a `note_type`, not a table of its own. Template rows are excluded from
 * the note list, the search, the badge count and Trash (the same `keep` clause
 * that drops legacy folders), and only the template panel reads them.
 */
export type NoteNodeType = "note" | "template";

export interface NoteNode {
  id: string; // "note-{uuid}" (legacy folder rows used "notefolder-{uuid}")
  type: NoteNodeType;
  title: string;
  content: string; // TipTap JSON string
  parentId: string | null;
  order: number;
  isPinned: boolean;
  hasPassword?: boolean;
  isEditLocked?: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export type NoteSortMode = "updatedAt" | "createdAt" | "title";

/**
 * A note body together with the version it belongs to (#2057): the
 * `items_meta.updated_at` the server held when this body was current. Saving
 * against a version is what lets the server refuse a write built on an old
 * body instead of silently replacing a newer one.
 */
export interface NoteBodySnapshot {
  content: string;
  updatedAt: string;
}

/**
 * What a version-checked body save came back with (#2057).
 *  - `saved`     written; `updatedAt` is the note's new version.
 *  - `conflict`  NOT written — the note had moved on. `current` is what is
 *                there now, for the caller to compare and resolve against.
 *  - `missing`   the note is gone (deleted, or never created).
 */
export type NoteBodySaveResult =
  | { status: "saved"; updatedAt: string }
  | { status: "conflict"; current: NoteBodySnapshot }
  | { status: "missing" };
