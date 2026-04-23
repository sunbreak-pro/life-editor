export interface DailyNode {
  id: string; // "daily-YYYY-MM-DD"
  date: string; // "YYYY-MM-DD"
  content: string; // TipTap JSON string
  isPinned?: boolean;
  hasPassword?: boolean;
  isEditLocked?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}
