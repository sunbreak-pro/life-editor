export interface DailyNode {
  id: string; // "daily-YYYY-MM-DD"
  date: string; // "YYYY-MM-DD"
  content: string; // TipTap JSON string
  isPinned?: boolean;
  hasPassword?: boolean;
  isEditLocked?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  /**
   * When the day's evening paper was published by its mood star (#2107,
   * 0034). Null = not published. The issue NUMBER is counted off the
   * 「気分: n/5」line, not this column — the two are kept in step by the star.
   */
  eveningPublishedAt?: string | null;
  /** One-line notes on the evening paper's rows: `todo:<id>` / `session:<id>` / `event:<id>` → text (#2107). */
  eveningNotes?: Record<string, string> | null;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}
