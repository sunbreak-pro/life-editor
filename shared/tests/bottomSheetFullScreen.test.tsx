import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BottomSheet } from "../src/components";

/*
 * BottomSheet's full-screen variant (#874).
 *
 * The bug it answers is a MOVEMENT: with a partial sheet open, focusing a field
 * brought up the soft keyboard, the shell stood its bottom tab bar down, and
 * the strip of page still showing behind the backdrop re-flowed upward. Taking
 * the whole screen removes the audience for that.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so "does it actually cover the screen"
 * is a 👀 gate on a real phone. What is pinned here is the DECISION — the
 * geometry classes that make it full-bleed, and the affordances that change
 * with it — plus the contract that does NOT change: one exit, under the same
 * name, whichever shape the panel took.
 */

/** The scrim the panel sits in — the sheet's outermost node. */
function backdropOf(dialog: HTMLElement): HTMLElement {
  const backdrop = dialog.parentElement;
  if (!backdrop) throw new Error("sheet backdrop missing");
  return backdrop;
}

/** The header strip — handle (sheet only) + title row, first child of the panel. */
function stripOf(dialog: HTMLElement): HTMLElement {
  const strip = dialog.firstElementChild;
  if (!(strip instanceof HTMLElement)) throw new Error("header strip missing");
  return strip;
}

/** A pointer event jsdom can build, carrying the coordinates the hook reads. */
function pointerEvent(type: string, clientY: number): Event {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 0,
    clientY,
  });
}

/** One press-drag-release downward, well past the hook's dismiss threshold. */
function swipeDown(target: HTMLElement) {
  fireEvent(target, pointerEvent("pointerdown", 0));
  fireEvent(target, pointerEvent("pointermove", 10));
  fireEvent(target, pointerEvent("pointermove", 240));
  fireEvent(target, pointerEvent("pointerup", 240));
}

function renderPanel(fullScreen: boolean, onClose = vi.fn()) {
  render(
    <BottomSheet
      open
      onClose={onClose}
      title="Detail"
      closeLabel="Close"
      fullScreen={fullScreen}
    >
      <p>panel body</p>
    </BottomSheet>,
  );
  return { onClose, dialog: screen.getByRole("dialog") };
}

describe("BottomSheet — full screen (#874)", () => {
  it("fills the viewport instead of rising part-way up it", () => {
    const { dialog } = renderPanel(true);

    expect(dialog.className).toContain("h-full");
    // max-w-lg is what keeps a sheet a card on a wide phone; at full screen it
    // would leave two live gutters of the page showing down either side —
    // exactly the strip this issue is about, turned sideways.
    expect(dialog.className).not.toContain("max-w-lg");
    expect(backdropOf(dialog).className).toContain("items-stretch");
  });

  it("leaves the partial sheet's geometry alone", () => {
    const { dialog } = renderPanel(false);

    expect(dialog.className).toContain("max-w-lg");
    expect(dialog.className).not.toContain("h-full");
    expect(backdropOf(dialog).className).toContain("items-end");
  });

  it("keeps one exit, under the same name (#525)", () => {
    const { onClose } = renderPanel(true);

    // The glyph became a back arrow, but the accessible name did not move —
    // every host and test that asks for the sheet's exit by `closeLabel` keeps
    // finding it, whichever shape the panel took.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not answer a swipe down", () => {
    const { onClose, dialog } = renderPanel(true);

    // A sheet is dragged back down to where it came from (#792). A full screen
    // has nowhere to go, so the gesture is off rather than left to fire a
    // dismissal the user cannot see coming.
    swipeDown(stripOf(dialog));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("still answers a swipe down as a partial sheet", () => {
    const { onClose, dialog } = renderPanel(false);

    swipeDown(stripOf(dialog));
    expect(onClose).toHaveBeenCalled();
  });

  it("scrolls its body inside the panel, not with it", () => {
    const { dialog } = renderPanel(true);

    /*
     * The header must not scroll away with the content: it holds the only exit.
     * So the scroller is a child of the panel rather than the panel itself.
     */
    const body = screen.getByText("panel body").parentElement;
    expect(body?.className).toContain("overflow-y-auto");
    expect(dialog.className).not.toContain("overflow-y-auto");
  });
});
