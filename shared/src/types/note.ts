/**
 * life-tags retirement (#375, the Notes-side follow-up to S3 #225): the
 * "folder" note type is gone — grouping is a life-tag now (buildTagGroups).
 * The union stays a named single-member type so the mapper / payload row keep
 * a name for the column, and so re-widening it stays a one-line change.
 * Legacy `note_type = 'folder'` rows still exist in the DB (rollback safety);
 * they are excluded at fetch time — see `isLegacyNoteFolderRow`.
 */
export type NoteNodeType = "note";

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
