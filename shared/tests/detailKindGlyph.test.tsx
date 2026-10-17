import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ItemRoleBadge,
  ResponsiveDetailFrame,
  Modal,
  type ItemRoleLabels,
} from "../src/components";

/*
 * #1044 — a detail panel names its kind ONCE, in the header, as a glyph.
 *
 * The two Schedule detail surfaces each printed the kind as a WORD in the
 * body: the event pane's 「予定」 origin chip, and the 「Todo」 the tag picker's
 * kind badge captioned the tag row with. Neither panel owns a header — the
 * title belongs to the frame — so the cue moves through a `titleIcon` slot on
 * the frame chain (ResponsiveDetailFrame → ItemDetailOverlay → Modal, and
 * BottomSheet).
 *
 * The glyph is the drawn lucide icon each kind already wears elsewhere
 * (itemRole.ts), never an emoji, and never a literal character: 「予」/「T」
 * would mix scripts and make the cue an i18n string.
 *
 * The accessibility half is the real risk. A glyph with no accessible name is
 * decoration, and the word it replaced was the only thing announcing the kind
 * — so `compact` gets `role="img"` and these cases assert the name through
 * `getByRole("img", { name })` rather than through the markup.
 */

const LABELS: ItemRoleLabels = {
  task: "Todo",
  event: "予定",
  note: "Note",
  daily: "Daily",
  unknown: "Other",
};

describe("ItemRoleBadge — compact (#1044)", () => {
  it("carries the kind name without printing it", () => {
    render(<ItemRoleBadge role="task" labels={LABELS} compact />);
    expect(screen.getByRole("img", { name: "Todo" })).toBeInTheDocument();
    expect(screen.queryByText("Todo")).toBeNull();
  });

  it("uses the section's own word for an event", () => {
    render(<ItemRoleBadge role="event" labels={LABELS} compact />);
    expect(screen.getByRole("img", { name: "予定" })).toBeInTheDocument();
  });

  it("falls back rather than borrowing a kind's icon for a routine", () => {
    // `routine` is deliberately outside the designed set (CLAUDE.md §4 — the
    // UI presents it as an Event with a repeat), so it must resolve to the
    // neutral badge, not to the event glyph.
    render(<ItemRoleBadge role="routine" labels={LABELS} compact />);
    expect(screen.getByRole("img", { name: "Other" })).toBeInTheDocument();
  });

  it("leaves the non-compact badge's a11y shape alone", () => {
    // Two live list surfaces still render the worded badge; giving it role=img
    // would announce its visible text twice.
    render(<ItemRoleBadge role="task" labels={LABELS} />);
    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

/*
 * #2219 retired the frame's kind slot together with its heading: the body's
 * first field is the item's own title, so the frame draws no header at all.
 * What the frame still owes on both widths is a NAME for the dialog and a
 * corner close (×) — Desktop had no close button before.
 */
describe("the frame without a heading (#2219)", () => {
  function renderFrame(wide: boolean) {
    const onClose = vi.fn();
    render(
      <ResponsiveDetailFrame
        wide={wide}
        open
        title="Details"
        closeLabel="Close"
        onClose={onClose}
      >
        <p>the body</p>
      </ResponsiveDetailFrame>,
    );
    return { onClose };
  }

  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("is named by its title without drawing it on %s", (_name, wide) => {
    renderFrame(wide);
    expect(screen.getByRole("dialog", { name: "Details" })).toBeInTheDocument();
    // A heading only a screen reader sees, or none at all — never a caption.
    const heading = screen.queryByRole("heading", { name: "Details" });
    if (heading) expect(heading).toHaveClass("sr-only");
  });

  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("closes from the corner button on %s", (_name, wide) => {
    const { onClose } = renderFrame(wide);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Modal heading with a glyph (#1044)", () => {
  it("keeps the dialog's accessible name out of the glyph's reach", () => {
    render(
      <Modal
        open
        onClose={() => {}}
        title="My Dialog"
        titleIcon={<span data-testid="glyph" />}
      >
        <p>body</p>
      </Modal>,
    );
    // The name comes from aria-label={title}; the glyph must not join it.
    expect(
      screen.getByRole("dialog", { name: "My Dialog" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading")).toContainElement(
      screen.getByTestId("glyph"),
    );
  });
});
