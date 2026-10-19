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

/**
 * The rule above a block in the detail panel (#1826), dropped on the well's
 * first child (#2285). The well stacks its portals in one plain div
 * (RightSidebarContents), so `first:` is whatever block opens the panel:
 * 朝刊's「きのうまでの自分」since the Todo tray left the morning panel (#2223).
 * 夕刊 opens with the tray, which wears no rule, so its blocks keep theirs.
 */
export const PANEL_BLOCK_RULE =
  "mt-4 border-t border-lumen-border pt-4 first:mt-0 first:border-t-0 first:pt-0";
