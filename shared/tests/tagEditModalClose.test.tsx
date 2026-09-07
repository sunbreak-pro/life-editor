import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagEditModal, type TagEditRow } from "../src/components";
import { TAG_LABELS, mockMatchMedia, restoreMatchMedia } from "./tagEditLabels";

/*
 * #1526 — the tag panel has a close button.
 *
 * Its only exits used to be Escape and the backdrop. On a phone that is no exit
 * at all: there is no physical keyboard, and the backdrop is the sliver of
 * margin left around a panel that fills the screen. Every BottomSheet has
 * carried a real button since #525; this is the same contract for the one panel
 * that is a Modal instead.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so the 44px floor is pinned as the
 * CLASS that produces it — `size-11` — the way sharedTapTargets.test.tsx pins
 * the rest of the shared chrome.
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

const closeButton = () =>
  screen.getByRole("button", { name: TAG_LABELS.closeLabel });

afterEach(() => {
  restoreMatchMedia();
});

describe("TagEditModal close button (#1526)", () => {
  it("closes the panel when pressed", () => {
    const onClose = vi.fn();
    render(<TagEditModal {...props({ onClose })} />);

    fireEvent.click(closeButton());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("meets the 44px touch floor in both directions", () => {
    render(<TagEditModal {...props()} />);

    // `size-11` is 2.75rem square. One utility per axis, not `h-11 w-11`
    // alongside a painted size: `cn` is a plain string join, so two utilities
    // for one property are settled by Tailwind's emit order (rules/frontend.md).
    expect(closeButton()).toHaveClass("size-11");
  });

  it("is there on a narrow screen, where it is the only exit that works", () => {
    mockMatchMedia(false);
    render(<TagEditModal {...props()} />);

    expect(closeButton()).toBeInTheDocument();
  });

  it("names the dialog from the heading it renders itself", () => {
    render(<TagEditModal {...props()} />);

    // The panel builds its own header now, so the accessible name has to come
    // back through `aria-labelledby` — losing it would be a silent regression
    // (the dialog would announce as nothing at all).
    expect(screen.getByRole("dialog", { name: TAG_LABELS.title })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: TAG_LABELS.title }),
    ).toBeInTheDocument();
  });

  it("opts out of the dialog's opening focus", () => {
    render(<TagEditModal {...props()} />);

    // The button is now first in DOM order, so without DIALOG_AUTOFOCUS_SKIP
    // the dialog's initial focus would land on "close" every single time
    // instead of in the add field. useDialogA11y reads exactly this attribute.
    expect(closeButton()).toHaveAttribute("data-dialog-autofocus", "skip");
    expect(closeButton()).not.toHaveFocus();
  });
});
