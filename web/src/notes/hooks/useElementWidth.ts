import { useCallback, useState } from "react";

/*
 * The rendered width of one element, in CSS px (#1471).
 *
 * Needed because the note column's width is not knowable statically: the left
 * nav collapses (w-16 / w-60), the right panel is drag-resizable over a
 * 240–560px range and persisted, and the section column is what is left after
 * both. Anything that has to be "as wide as a note" — the template editor,
 * which is portaled out of that column into a centred modal — has to measure
 * it.
 *
 * Returns a ref CALLBACK rather than taking a ref object: the observer can then
 * attach the moment the node arrives and tear down when it leaves, which a ref
 * object gives no signal for. React 19's ref cleanup return is what makes that
 * a three-line lifecycle instead of a second observer ref.
 *
 * null until the element has a width — which is the whole of the run under
 * jsdom, where nothing has layout (CLAUDE.md §7.1). Callers must keep a CSS
 * fallback for that case rather than treating null as zero.
 */
export function useElementWidth(): [
  (el: HTMLElement | null) => void,
  number | null,
] {
  const [width, setWidth] = useState<number | null>(null);

  const measureRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const read = () => {
      const measured = el.getBoundingClientRect().width;
      // Rounded: sub-pixel column widths would otherwise re-render the tree on
      // every fractional wobble of the resize handle, and no layout downstream
      // can tell 641.6 from 642.
      setWidth(measured > 0 ? Math.round(measured) : null);
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [measureRef, width];
}
