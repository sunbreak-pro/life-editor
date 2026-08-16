import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomSheet } from "../src/components";

/*
 * The sheet's bottom padding clears the home indicator (#1008).
 *
 * The panel is `items-end` inside a `fixed inset-0` parent, so its bottom edge
 * is the bottom of the SCREEN — there is no shell padding between them. A flat
 * `pb-6` therefore put the last row of every sheet under the iOS indicator bar
 * in standalone; the tab bar's "More" sheet is where it showed.
 *
 * Asserted on the class rather than on geometry because jsdom has no layout
 * (CLAUDE.md §7.1) and never resolves `env()` — the same reason appShell's
 * safe-area test reads className. That makes this a spelling guard, which is
 * the failure mode worth guarding: the padding lives inside a `cn()` string of
 * six utilities, and `cn` is plain concatenation, so a lost or duplicated
 * class fails silently rather than erroring.
 */

const panel = () => screen.getByRole("dialog");

describe("BottomSheet bottom padding", () => {
  it("reserves the home-indicator strip on the sheet variant", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Sheet" closeLabel="Close">
        <button type="button">last row</button>
      </BottomSheet>,
    );

    // max(), not a sum: 24px already clears an inset smaller than it, and an
    // inset of 0 (Desktop, Android browsers) must leave the spacing alone.
    expect(panel().className).toContain(
      "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
    );
    expect(panel().className).not.toContain("pb-6");
  });

  it("lets the full-screen variant add the inset from its inline style", () => {
    render(
      <BottomSheet
        open
        onClose={() => {}}
        title="Sheet"
        closeLabel="Close"
        fullScreen
      >
        <button type="button">last row</button>
      </BottomSheet>,
    );

    /*
     * fullScreen spans the whole screen, so it wants its own padding ON TOP of
     * the indicator rather than the larger of the two — and an inline style
     * beats the class outright, which is what lets both live on one element.
     */
    expect(panel().style.paddingBottom).toBe(
      "calc(1.5rem + env(safe-area-inset-bottom))",
    );
  });
});
