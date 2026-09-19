import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal, TagIconPicker } from "../src/components";

/*
 * #1342 — Escape over the open icon picker took the whole surrounding dialog
 * with it, and that dialog held unsaved edits behind a Save button. Cancelling
 * an icon choice must not be the same keypress that throws the draft away.
 *
 * The cause was ordering, not a missing handler: a dialog's Escape sits on
 * `document` in the CAPTURE phase, so the picker's own listener (bubble, on the
 * same node) was never reached. The picker takes a layer in the dialog stack,
 * which makes the topmost surface the only one Escape gets to — see
 * `useEscapeLayer` in shared/src/hooks/useDialogA11y.ts.
 *
 * The host is a plain <Modal> rather than the tag edit modal these cases were
 * written against: #1643 retired that panel into the Connect hub, where the
 * picker now sits in an inline block with no dialog of its own. The CONTRACT
 * being pinned belongs to the picker either way — it is "whatever dialog I am
 * inside of, I take Escape first" — so the guard outlives its first host by
 * being given a generic one.
 */

const LABELS = {
  iconLabel: "Icon",
  clearIconLabel: "Default icon",
  searchLabel: "Search icons",
  noMatchLabel: "No icon matches that.",
};

/** The picker's trigger and its grid share the one label, so they are told
 *  apart by role — button for the trigger, group for the popover. */
const iconTrigger = (): HTMLElement =>
  screen.getByRole("button", { name: LABELS.iconLabel });
const pickerIsOpen = (): boolean =>
  screen.queryByRole("group", { name: LABELS.iconLabel }) !== null;

const pressEscape = (over: Record<string, unknown> = {}): void => {
  fireEvent.keyDown(document, { key: "Escape", ...over });
};

function Picker({
  onPick = vi.fn(),
}: {
  onPick?: (icon: string | null) => void;
}) {
  return (
    <TagIconPicker
      current={null}
      color={null}
      onPick={onPick}
      labels={LABELS}
    />
  );
}

function renderInDialog(onClose: () => void) {
  render(
    <Modal open onClose={onClose} title="Tags">
      <Picker />
    </Modal>,
  );
}

describe("TagIconPicker — Escape closes the picker before the dialog (#1342)", () => {
  it("closes only the picker on the first Escape", () => {
    const onClose = vi.fn();
    renderInDialog(onClose);
    fireEvent.click(iconTrigger());
    expect(pickerIsOpen()).toBe(true);

    pressEscape();

    expect(pickerIsOpen()).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the surface and its unsaved field on screen", () => {
    // A mocked onClose leaves `open` true, so the dialog would survive either
    // way. This host actually closes on the callback — the shape the bug was
    // reported in, where the draft went with the panel.
    function Host() {
      const [open, setOpen] = useState(true);
      const [name, setName] = useState("workshop");
      return (
        <Modal open={open} onClose={() => setOpen(false)} title="Tags">
          <input
            aria-label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Picker />
        </Modal>
      );
    }
    render(<Host />);
    fireEvent.click(iconTrigger());

    pressEscape();

    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
      "workshop",
    );
  });

  it("closes the dialog on the second Escape", () => {
    const onClose = vi.fn();
    renderInDialog(onClose);
    fireEvent.click(iconTrigger());

    pressEscape();
    pressEscape();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("still closes the dialog on Escape when no picker is open", () => {
    const onClose = vi.fn();
    renderInDialog(onClose);

    pressEscape();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves both alone mid-IME-composition (§frontend gotcha)", () => {
    const onClose = vi.fn();
    renderInDialog(onClose);
    fireEvent.click(iconTrigger());

    pressEscape({ isComposing: true });

    expect(pickerIsOpen()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hands Escape back to the dialog after the picker is closed by a pick", () => {
    const onClose = vi.fn();
    renderInDialog(onClose);
    fireEvent.click(iconTrigger());
    fireEvent.click(
      screen.getByRole("button", { name: LABELS.clearIconLabel }),
    );
    expect(pickerIsOpen()).toBe(false);

    pressEscape();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
