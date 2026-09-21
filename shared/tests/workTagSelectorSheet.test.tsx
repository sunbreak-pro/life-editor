import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  WorkTagSelector,
  type WorkTagSelectorProps,
} from "../src/components/WorkTagSelector";

/*
 * #1856 — the narrow-screen shape of the Work tag field.
 *
 * At 390px the anchored popover opened with its left edge off screen and its
 * list under the tab bar, and the trigger was 31.5px tall. jsdom has no layout
 * (every rect is 0), so neither number can be measured here. What is pinned is
 * the structure that makes them impossible: with `sheet` the picker is a
 * BottomSheet portalled to <body> (positioned by the viewport, not by the
 * field), and the trigger carries the 44px floor. Without `sheet` the desktop
 * popover is exactly what it was.
 */

const LABELS: WorkTagSelectorProps["labels"] = {
  heading: "Tags",
  add: "Add a tag",
  addShort: "Tag",
  search: "Search or create",
  create: (name) => `Create ${name}`,
  remove: (name) => `Remove ${name}`,
  noCandidates: "No tags yet",
  dialog: "Free session tags",
  disabledHint: "Clear the work name to use tags.",
};

const TAGS = [
  { id: "tag-1", name: "writing", color: null },
  { id: "tag-2", name: "reading", color: null },
];

function renderSelector(overrides?: Partial<WorkTagSelectorProps>) {
  const onChange = vi.fn();
  const onCreate = vi.fn(async (name: string) => ({
    id: "tag-new",
    name,
    color: null,
  }));
  render(
    <WorkTagSelector
      tags={TAGS}
      selectedIds={[]}
      onChange={onChange}
      onCreate={onCreate}
      labels={LABELS}
      {...overrides}
    />,
  );
  return { onChange, onCreate };
}

const trigger = () => screen.getByRole("button", { name: "Add a tag" });

describe("WorkTagSelector — sheet presentation (#1856)", () => {
  it("opens the picker in a sheet outside the field", () => {
    renderSelector({ sheet: { closeLabel: "Close" } });
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog", { name: "Free session tags" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // Portalled: the field that was centred near the bottom of the screen no
    // longer decides where the picker lands.
    expect(screen.getByTestId("work-tag-selector")).not.toContainElement(
      dialog,
    );
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("gives the trigger and the rows the 44px floor", () => {
    renderSelector({ sheet: { closeLabel: "Close" } });
    expect(trigger()).toHaveClass("min-h-11");
    fireEvent.click(trigger());
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "writing" })).toHaveClass(
      "min-h-11",
    );
    expect(within(dialog).getByPlaceholderText("Search or create")).toHaveClass(
      "min-h-11",
    );
  });

  it("adds a tag from the sheet and stays open for the next one", () => {
    const { onChange } = renderSelector({ sheet: { closeLabel: "Close" } });
    fireEvent.click(trigger());
    const dialog = screen.getByRole("dialog");
    // A press inside the sheet is outside the field's container; the
    // click-outside listener must not read it as a dismissal.
    fireEvent.mouseDown(
      within(dialog).getByRole("button", { name: "writing" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "writing" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(["tag-1"]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes from the sheet's close button", () => {
    renderSelector({ sheet: { closeLabel: "Close" } });
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not open while disabled", () => {
    renderSelector({ sheet: { closeLabel: "Close" }, disabled: true });
    fireEvent.click(trigger());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the desktop popover anchored inside the field, at its old size", () => {
    renderSelector();
    expect(trigger()).not.toHaveClass("min-h-11");
    fireEvent.click(trigger());

    const dialog = screen.getByRole("dialog", { name: "Free session tags" });
    expect(screen.getByTestId("work-tag-selector")).toContainElement(dialog);
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(dialog).toHaveClass("absolute", "right-0", "w-64");
    expect(
      within(dialog).getByRole("button", { name: "writing" }),
    ).not.toHaveClass("min-h-11");
  });
});
