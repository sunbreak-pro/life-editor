import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagEditModal, type TagEditRow } from "../src/components";
import { TAG_LABELS, nameField, selectTagRow, typeName } from "./tagEditLabels";

/*
 * #1342 — Escape over the open icon picker took the whole tag edit panel with
 * it, and the panel holds unsaved edits behind a Save button. Cancelling an
 * icon choice must not be the same keypress that throws the draft away.
 *
 * The cause was ordering, not a missing handler: the panel is a dialog whose
 * Escape sits on `document` in the CAPTURE phase, so the picker's own listener
 * (bubble, on the same node) was never reached. The picker now takes a layer in
 * the dialog stack, which makes the topmost surface the only one Escape gets
 * to — see `useEscapeLayer` in shared/src/hooks/useDialogA11y.ts.
 */

const ROWS: TagEditRow[] = [
  { id: "tag-1", name: "work", color: null, icon: null, count: 2, items: [] },
];

type ModalProps = React.ComponentProps<typeof TagEditModal>;

function props(over: Partial<ModalProps> = {}): ModalProps {
  return {
    open: true,
    onClose: vi.fn(),
    tags: ROWS,
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onSetColor: vi.fn(),
    onSetIcon: vi.fn(),
    onUnassign: vi.fn(),
    formatCount: (count: number) => `${count} items`,
    labels: TAG_LABELS,
    ...over,
  };
}

/** The picker's trigger and its grid share the one label, so they are told
 *  apart by role — button for the trigger, group for the popover. */
const iconTrigger = (): HTMLElement =>
  screen.getByRole("button", { name: TAG_LABELS.iconLabel });
const pickerIsOpen = (): boolean =>
  screen.queryByRole("group", { name: TAG_LABELS.iconLabel }) !== null;

const pressEscape = (over: Record<string, unknown> = {}): void => {
  fireEvent.keyDown(document, { key: "Escape", ...over });
};

describe("TagIconPicker — Escape closes the picker before the panel (#1342)", () => {
  it("closes only the picker on the first Escape", () => {
    const onClose = vi.fn();
    render(<TagEditModal {...props({ onClose })} />);
    selectTagRow("work");
    fireEvent.click(iconTrigger());
    expect(pickerIsOpen()).toBe(true);

    pressEscape();

    expect(pickerIsOpen()).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the panel and its unsaved name on screen", () => {
    // A mocked onClose leaves `open` true, so the panel would survive either
    // way. This host actually closes on the callback — the shape the bug was
    // reported in, where the draft went with the panel.
    function Host() {
      const [open, setOpen] = useState(true);
      return <TagEditModal {...props({ open, onClose: () => setOpen(false) })} />;
    }
    render(<Host />);
    selectTagRow("work");
    typeName("workshop");
    fireEvent.click(iconTrigger());

    pressEscape();

    expect(nameField().value).toBe("workshop");
  });

  it("closes the panel on the second Escape", () => {
    const onClose = vi.fn();
    render(<TagEditModal {...props({ onClose })} />);
    selectTagRow("work");
    fireEvent.click(iconTrigger());

    pressEscape();
    pressEscape();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("still closes the panel on Escape when no picker is open", () => {
    const onClose = vi.fn();
    render(<TagEditModal {...props({ onClose })} />);
    selectTagRow("work");

    pressEscape();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves both alone mid-IME-composition (§frontend gotcha)", () => {
    const onClose = vi.fn();
    render(<TagEditModal {...props({ onClose })} />);
    selectTagRow("work");
    fireEvent.click(iconTrigger());

    pressEscape({ isComposing: true });

    expect(pickerIsOpen()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hands Escape back to the panel after the picker is closed by a pick", () => {
    const onClose = vi.fn();
    render(<TagEditModal {...props({ onClose })} />);
    selectTagRow("work");
    fireEvent.click(iconTrigger());
    fireEvent.click(screen.getByRole("button", { name: TAG_LABELS.clearIconLabel }));
    expect(pickerIsOpen()).toBe(false);

    pressEscape();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
