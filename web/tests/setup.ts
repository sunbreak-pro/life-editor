// Vitest global setup for the web suite. Loaded via vitest.config.ts `setupFiles`.
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { clearDomainSnapshots } from "@life-editor/shared";

/*
 * jsdom implements no layout and therefore no `elementFromPoint`, but
 * ProseMirror calls it on every mousedown (posAtCoords). Without this the call
 * throws an uncaught TypeError out of the event listener, so any test that
 * dispatches a real mousedown into the editor fails the run even when its own
 * assertions pass.
 *
 * Returning null is the truthful answer for a document with no layout, and it
 * is one ProseMirror already handles: posAtCoords falls back to the view's
 * (all-zero) bounding rect, finds the point outside it and returns null — so
 * the coordinate-based single-click pipeline simply does not run. That is
 * exactly the condition #475 is about, which is why click navigation must not
 * depend on it.
 */
if (typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}

/*
 * The stale-while-revalidate store (#1101 / #1157) is a module-level Map, so it
 * outlives every render in a file and would carry one test's rows into the
 * next. Today the DataService identity check hides that — each suite builds a
 * fresh stub — but a suite that reuses one `ds` across two tests would silently
 * skip its fetch and fail somewhere unrelated.
 */
beforeEach(() => {
  clearDomainSnapshots();
});

afterEach(() => {
  cleanup();
});
