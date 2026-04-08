export type NoteNodeType = "folder" | "note";

export interface NoteNode {
  id: string; // "note-{uuid}" or "notefolder-{uuid}"
  type: NoteNodeType;
  title: string;
  content: string; // TipTap JSON string
  parentId: string | null;
  order: number;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export type NoteSortMode = "updatedAt" | "createdAt" | "title";
