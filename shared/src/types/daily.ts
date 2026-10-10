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
  /**
   * Claude's morning comment — the paragraphs MCP `write_briefing` writes
   * (0035, D-20261007-briefing-1). It lives beside the body, never in it.
   * Null = not written to the column: an older day keeps its comment as the
   * 朝刊 heading section of `content`, and `readMorningRecord` falls back to
   * that section.
   */
  morningComment?: string[] | null;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}
