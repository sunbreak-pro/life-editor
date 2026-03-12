export interface NoteNode {
  id: string; // "note-{uuid}"
  title: string;
  content: string; // TipTap JSON string
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export type NoteSortMode = "updatedAt" | "createdAt" | "title";
