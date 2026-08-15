/*
 * Class strings shared by more than one block of the paper.
 *
 * Own module so the two users can reach it without importing each other:
 * BriefingView renders <GoalsBlock>, so a constant exported from BriefingView
 * would make that import circular.
 */

/**
 * Annotation pinned to a heading's right edge — the 琥珀 side of the accent duo
 * (context, never a control). Used by the section headings' `hint` and by the
 * goal fields' period ranges, which are the same kind of note in a smaller
 * heading (#872).
 */
export const BRIEFING_HINT_CLASS =
  "text-xs tracking-wider text-lumen-briefing-kohaku";
