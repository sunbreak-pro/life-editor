export interface MemoNode {
  id: string; // "memo-YYYY-MM-DD"
  date: string; // "YYYY-MM-DD"
  content: string; // TipTap JSON string
  isPinned?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}
