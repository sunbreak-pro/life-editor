import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BottomSheet } from "../src/components";

/*
 * BottomSheet dismissal (#470). The sheet used to keep a press inside its panel
 * from closing it by calling stopPropagation on the panel's mousedown. That
 * also stopped the NATIVE event, and React dispatches portal events from the
 * portal container (document.body) — so nothing inside a sheet ever reached a
 * document-level mousedown listener. Every click-outside popover placed inside
 * a sheet (the TagPicker in the mobile task detail is the first) then had no way
 * to close. Dismissal now checks the press actually landed on the backdrop, so
 * the panel no longer has to swallow the event.
 */

function backdropOf(dialog: HTMLElement): HTMLElement {
  const backdrop = dialog.parentElement;
  if (!backdrop) throw new Error("sheet backdrop missing");
  return backdrop;
}

describe("BottomSheet dismissal", () => {
  const listeners: (() => void)[] = [];
  afterEach(() => {
    listeners.splice(0).forEach((off) => off());
  });

  /** Registers a document mousedown spy that is removed after the test. */
  function watchDocumentMouseDown() {
    const seen = vi.fn();
    document.addEventListener("mousedown", seen);
    listeners.push(() => document.removeEventListener("mousedown", seen));
    return seen;
  }

  it("lets a press inside the panel reach a document listener", () => {
    const seen = watchDocumentMouseDown();
    render(
      <BottomSheet open onClose={() => {}} title="Sheet" closeLabel="Close">
        <button type="button">inside</button>
      </BottomSheet>,
    );

    fireEvent.mouseDown(screen.getByText("inside"));
    expect(seen).toHaveBeenCalled();
  });

  it("stays open when the press lands inside the panel", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Sheet" closeLabel="Close">
        <button type="button">inside</button>
      </BottomSheet>,
    );

    fireEvent.mouseDown(screen.getByText("inside"));
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when the backdrop itself is pressed", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Sheet" closeLabel="Close">
        <button type="button">inside</button>
      </BottomSheet>,
    );

    fireEvent.mouseDown(backdropOf(screen.getByRole("dialog")));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores a backdrop press when closeOnBackdrop is off", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet
        open
        onClose={onClose}
        title="Sheet"
        closeLabel="Close"
        closeOnBackdrop={false}
      >
        <button type="button">inside</button>
      </BottomSheet>,
    );

    fireEvent.mouseDown(backdropOf(screen.getByRole("dialog")));
    expect(onClose).not.toHaveBeenCalled();
  });

  /*
   * #525 — the explicit exit. The two dismissals above are the only ones the
   * sheet had, and on a phone neither is reachable: a 92vh detail sheet leaves
   * 8vh of backdrop, and Escape wants a physical keyboard. So the button is
   * unconditional, and it closes even where the backdrop deliberately does not.
   */
  it("closes when the close button is pressed", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet
        open
        onClose={onClose}
        title="Sheet"
        closeLabel="Close"
        closeOnBackdrop={false}
      >
        <button type="button">inside</button>
      </BottomSheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives a titleless sheet the same exit", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} closeLabel="Close">
        <p>read-only detail</p>
      </BottomSheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
