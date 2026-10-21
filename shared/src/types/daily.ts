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
  /**
   * False on a row from the light list read (#2325): `content` is then ""
   * and is NOT the day's body, which has not been fetched. Absent or true
   * means `content` is the body. A writer must never build a save on a row
   * whose body is not loaded — it would write the emptiness over the day.
   */
  bodyLoaded?: boolean;
  /**
   * The head of the body on a light row (#2325): the first top-level blocks
   * as a TipTap doc JSON, enough for the list's excerpt. Undefined when the
   * head could not be read (a legacy plain-text body, or an empty one).
   */
  headContent?: string;
}
