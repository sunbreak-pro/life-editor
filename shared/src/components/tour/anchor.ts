/*
 * Anchor resolution for the tour (#1122).
 *
 * The tour finds its target by ATTRIBUTE, never by coordinates. That is a
 * testability constraint before it is a style one: jsdom implements no layout,
 * so every `getBoundingClientRect()` is all-zero and `elementFromPoint` is
 * null (CLAUDE.md §7.1). A rect-based anchor — or a "skip the step if the
 * element measures 0×0" heuristic — would skip EVERY step under test while
 * looking fine in a browser, which is the #475 shape exactly. Existence of the
 * element is the whole decision; rects are read later, for placement only.
 *
 * `data-tour-id` follows `data-section-id` on the Settings cards, and collides
 * with none of the app's existing data-* attributes.
 */

/** The attribute a component carries to become a tour target. */
export const TOUR_ANCHOR_ATTRIBUTE = "data-tour-id";

/**
 * How long a step waits for its anchor before being skipped.
 *
 * Not zero, because the anchor usually appears some renders AFTER the tour
 * asks for it: the step's section has to mount first, and a section switch is
 * a state update rather than a synchronous DOM write. Not unbounded either —
 * that is the difference between "the element is on its way" and "this step
 * can never be shown here" (a mobile-omitted control, a retired layout), and
 * the second one has to end the wait rather than hang the tour.
 *
 * WALL CLOCK rather than a frame count, and generous, because the section
 * body can be a code-split chunk still being fetched (Notes / Analytics /
 * Connect — web/src/lazySections.ts). A frame budget would be spent against
 * the `<Suspense>` fallback and every step anchored in a lazy section would be
 * dropped on a cold load. 2.5s is long enough for that chunk and still short
 * enough that a genuinely absent anchor does not read as a hang.
 */
export const TOUR_ANCHOR_TIMEOUT_MS = 2500;

/**
 * Find the element a step points at, or null when it is not in the document.
 *
 * The value goes into a quoted attribute selector, so the two characters that
 * could break out of that string are escaped. `CSS.escape` is the wrong tool
 * here — it escapes for IDENTIFIER position, and these values sit inside a
 * string.
 */
export function resolveTourAnchor(anchor: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const escaped = anchor.replace(/["\\]/g, "\\$&");
  return document.querySelector<HTMLElement>(
    `[${TOUR_ANCHOR_ATTRIBUTE}="${escaped}"]`,
  );
}

/**
 * Spread onto the element a step should point at:
 * `<button {...tourAnchor("materials-add")}>`.
 *
 * A helper rather than a hand-written attribute so call sites cannot misspell
 * the attribute name and silently become invisible to the tour.
 */
export function tourAnchor(anchor: string): { "data-tour-id": string } {
  return { [TOUR_ANCHOR_ATTRIBUTE]: anchor } as { "data-tour-id": string };
}
