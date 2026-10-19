import type { BubbleMenuProps } from "@tiptap/react/menus";
import { NOTE_STICKY_HEADER_HEIGHT_VAR } from "@life-editor/shared";

/*
 * Where the floating format bar (FormatToolbar.tsx) lands, in its own module
 * so the component file exports components only (react-refresh) and the test
 * can read it: jsdom has no layout to show where the bar ends up.
 *
 * Above the selection at every width (#2288 — narrow used to put it below, to
 * keep clear of the copy / paste menu iOS draws above a selection; whether the
 * two overlap on a phone is checked on the device). `flip` moves the bar below
 * when there is no room above; the room above counts the note's sticky header
 * (#2058) as taken, read off NOTE_STICKY_HEADER_HEIGHT_VAR, so a selection
 * right under the header gets the bar below it instead of behind the header.
 * `shift` keeps the bar inside the screen near its left and right edges.
 */

type MenuOptions = NonNullable<BubbleMenuProps["options"]>;

/** Space kept between the bar and the screen's (or the header's) edge. */
const EDGE_GAP = 8;

function stickyHeaderHeight(el: Element): number {
  const px = Number.parseFloat(
    getComputedStyle(el).getPropertyValue(NOTE_STICKY_HEADER_HEIGHT_VAR),
  );
  return Number.isFinite(px) ? px : 0;
}

export const FORMAT_BUBBLE_OPTIONS: MenuOptions = {
  placement: "top",
  offset: EDGE_GAP,
  flip: (state) => ({
    padding: {
      top: stickyHeaderHeight(state.elements.floating) + EDGE_GAP,
      bottom: EDGE_GAP,
      left: EDGE_GAP,
      right: EDGE_GAP,
    },
  }),
  shift: { padding: EDGE_GAP },
};
