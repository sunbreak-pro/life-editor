import { describe, it, expect, vi } from "vitest";
import { useEffect, useRef, useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BottomSheet, Modal } from "../src/components";

/*
 * Dialog focus behaviour (#508). BottomSheet declared aria-modal from day one
 * but had no trap and no initial focus: opening a sheet left the focus on the
 * card behind it and Tab walked the page underneath. Every sheet until #470's
 * detail sheet held an input that focused itself, which is why nobody saw it.
 *
 * Both surfaces now share useDialogA11y, so these cases cover Modal too — most
 * of all the layering one, where the OLD implementation gave an Escape meant
 * for the modal on top to the sheet underneath (document listeners fire in
 * registration order, which is the reverse of stacking order).
 */

/** Runs the pending rAF callback — that is when initial focus is applied. */
async function afterFrame() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

function FocusItsInput({ label }: { label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return <input ref={ref} aria-label={label} />;
}

describe("dialog focus (BottomSheet + Modal)", () => {
  // Still "first", not the close button that now precedes it in the DOM (#525):
  // opening a sheet onto "Close, button" would announce the exit before the
  // content. That is what DIALOG_AUTOFOCUS_SKIP buys.
  it("moves focus to the first control inside the sheet on open", async () => {
    render(
      <BottomSheet open onClose={() => {}} title="Sheet" closeLabel="Close">
        <button type="button">first</button>
        <button type="button">second</button>
      </BottomSheet>,
    );

    await afterFrame();
    expect(document.activeElement).toBe(screen.getByText("first"));
  });

  // The close button does not count as focusable content here either — a sheet
  // of plain text still falls back to the panel.
  it("falls back to the panel when the sheet holds nothing focusable", async () => {
    render(
      <BottomSheet open onClose={() => {}} title="Sheet" closeLabel="Close">
        <p>read-only detail</p>
      </BottomSheet>,
    );

    await afterFrame();
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("leaves focus alone when a child claimed it", async () => {
    render(
      <BottomSheet open onClose={() => {}} title="Sheet" closeLabel="Close">
        <button type="button">first</button>
        <FocusItsInput label="draft" />
      </BottomSheet>,
    );

    await afterFrame();
    expect(document.activeElement).toBe(screen.getByLabelText("draft"));
  });

  it("cycles Tab and Shift+Tab inside the sheet", async () => {
    render(
      <BottomSheet open onClose={() => {}} title="Sheet" closeLabel="Close">
        <button type="button">first</button>
        <button type="button">last</button>
      </BottomSheet>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    const last = screen.getByText("last");
    await afterFrame();

    // The close button (#525) sits first in the panel, so it is where the cycle
    // wraps — it is skipped for the INITIAL focus only, not for Tab.
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("pulls focus back in when it is loose on the page", async () => {
    render(
      <BottomSheet open onClose={() => {}} title="Sheet" closeLabel="Close">
        <button type="button">first</button>
        <button type="button">last</button>
      </BottomSheet>,
    );
    await afterFrame();

    // A backdrop press leaves the focus on <body> — Tab must not walk from
    // there into the page behind the sheet.
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" }),
    );
  });

  it("returns focus to the opener when the sheet closes", async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            open
          </button>
          <BottomSheet
            open={open}
            onClose={() => setOpen(false)}
            title="Sheet"
            closeLabel="Close"
          >
            <button type="button">inside</button>
          </BottomSheet>
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByText("open");

    opener.focus();
    fireEvent.click(opener);
    await afterFrame();
    expect(document.activeElement).toBe(screen.getByText("inside"));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(opener);
  });

  it("closes the sheet on Escape but not mid-IME-composition", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Sheet" closeLabel="Close">
        <input aria-label="title" />
      </BottomSheet>,
    );

    fireEvent.keyDown(document, { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives Escape to the top layer only, and hands it back on close", () => {
    const onCloseSheet = vi.fn();
    const onCloseModal = vi.fn();
    function Stack({ modalOpen }: { modalOpen: boolean }) {
      return (
        <>
          <BottomSheet
            open
            onClose={onCloseSheet}
            title="Sheet"
            closeLabel="Close"
          >
            <button type="button">sheet button</button>
          </BottomSheet>
          <Modal open={modalOpen} onClose={onCloseModal} title="Modal">
            <button type="button">modal button</button>
          </Modal>
        </>
      );
    }
    const { rerender } = render(<Stack modalOpen />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseModal).toHaveBeenCalledTimes(1);
    expect(onCloseSheet).not.toHaveBeenCalled();

    rerender(<Stack modalOpen={false} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseSheet).toHaveBeenCalledTimes(1);
    expect(onCloseModal).toHaveBeenCalledTimes(1);
  });
});
