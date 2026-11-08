import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  Modal,
  TagHubEditBlock,
  TagIconPicker,
  type TagHubTagSummary,
} from "../src/components";
import { TAG_HUB_LABELS } from "./tagHubLabels";

/*
 * #2500 — at 390px the icon panel is 354 x 808, nearly the whole screen, and
 * nothing inside it closed it except picking "Default icon". The only other
 * exit was the backdrop's ~16px strip, and iOS has no Esc key. The panel now
 * carries Modal's corner close button.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so where the button lands is checked in
 * a real browser. What is pinned here is structure: the button exists, it sits
 * on the panel itself (outside the scrolling body, beside the heading), it is
 * 44px under 768px by class, and it closes only the panel.
 */

const LABELS = {
  iconLabel: "Icon",
  clearIconLabel: "Default icon",
  searchLabel: "Search icons",
  noMatchLabel: "No icon matches that.",
  moreLabel: "Show more",
  countLabel: "{count} icons",
  closeLabel: "Close the icon list",
};

const classesOf = (el: Element): string[] =>
  el.getAttribute("class")?.split(/\s+/).filter(Boolean) ?? [];

const openPanel = (): void => {
  fireEvent.click(screen.getByRole("button", { name: LABELS.moreLabel }));
};
const panel = (): HTMLElement | null =>
  screen.queryByRole("dialog", { name: LABELS.iconLabel });
const closeButton = (): HTMLElement =>
  screen.getByRole("button", { name: LABELS.closeLabel });

function Picker() {
  return (
    <TagIconPicker
      current={null}
      color={null}
      onPick={vi.fn()}
      labels={LABELS}
    />
  );
}

beforeEach(cleanup);

describe("TagIconPicker — the panel has a close button (#2500)", () => {
  it("draws no close button while the panel is shut", () => {
    render(<Picker />);

    expect(
      screen.queryByRole("button", { name: LABELS.closeLabel }),
    ).toBeNull();
  });

  it("puts the close button on the panel, beside the heading", () => {
    render(<Picker />);
    openPanel();

    const dialog = panel()!;
    const button = closeButton();
    // A direct child of the panel, not of the scrolling body: the button
    // stays in reach while the 146-glyph grid scrolls under the heading.
    expect(button.parentElement).toBe(dialog);
    expect(dialog.querySelector("h2")?.textContent).toBe(LABELS.iconLabel);
  });

  it("is a 44px target under 768px and 32px on Desktop", () => {
    render(<Picker />);
    openPanel();

    const classes = classesOf(closeButton());
    expect(classes).toContain("max-md:size-11");
    expect(classes).toContain("size-8");
  });

  it("closes the panel and leaves the surrounding dialog standing", () => {
    const hostClose = vi.fn();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <Modal
          open={open}
          onClose={() => {
            hostClose();
            setOpen(false);
          }}
          title="Tags"
        >
          <input aria-label="Name" defaultValue="workshop" />
          <Picker />
        </Modal>
      );
    }
    render(<Host />);
    openPanel();

    fireEvent.click(closeButton());

    expect(panel()).toBeNull();
    expect(hostClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Tags" })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
      "workshop",
    );
  });

  it("hands Escape back to the surrounding dialog once closed by the button", () => {
    const hostClose = vi.fn();
    render(
      <Modal open onClose={hostClose} title="Tags">
        <Picker />
      </Modal>,
    );
    openPanel();
    fireEvent.click(closeButton());

    fireEvent.keyDown(document, { key: "Escape" });

    expect(hostClose).toHaveBeenCalledTimes(1);
  });

  it("still closes on Escape, as before", () => {
    render(<Picker />);
    openPanel();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(panel()).toBeNull();
  });
});

describe("TagHubEditBlock — the tag edit block passes the close label through (#2500)", () => {
  const WORK: TagHubTagSummary = {
    id: "t-work",
    name: "Work",
    color: null,
    icon: null,
    count: 1,
    isUntagged: false,
  };

  it("names the panel's close button with the hub's iconClose copy", () => {
    render(
      <TagHubEditBlock
        tag={WORK}
        edits={{}}
        dirty={false}
        onEdit={vi.fn()}
        onDropEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        labels={TAG_HUB_LABELS.edit}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: TAG_HUB_LABELS.edit.iconMore }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: TAG_HUB_LABELS.edit.iconClose }),
    );

    expect(
      screen.queryByRole("dialog", { name: TAG_HUB_LABELS.edit.iconLabel }),
    ).toBeNull();
  });
});
