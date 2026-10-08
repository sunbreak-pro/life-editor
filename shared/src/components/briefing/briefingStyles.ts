/*
 * Class strings shared by more than one block of the paper.
 *
 * Own module so the blocks outside BriefingView can use them without reaching
 * into the view for a string. The first such block was GoalsBlock, which the
 * view rendered (an import back would have been circular); since #2106 it is
 * MorningGoalsBlock, which the host hands the view as a slot.
 */

/**
 * Annotation pinned to a heading's right edge — the 琥珀 side of the accent duo
 * (context, never a control). Used by the section headings' `hint` and by the
 * goals block's period labels (#2106), which are the same kind of note in a
 * smaller heading (#872).
 */
export const BRIEFING_HINT_CLASS =
  "text-xs tracking-wider text-lumen-briefing-kohaku";
