import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ItemActionPopover } from "../src/components";
import type { ItemAction } from "../src/components";

/*
 * ItemActionPopover (#307 → #551) — the unified item panel: left AND right
 * click both open this bubble. #551 folded the retired ItemContextMenu into
 * it, so the inline-input swap (rename) is covered here now: selecting the
 * action swaps the list for a seeded input (Enter commits, Escape cancels,
 * IME-safe) and hides the edit-detail button while the input is up.
 */

function renderPopover(overrides?: {
  onRename?: (v: string) => void;
  onEditDetail?: () => void;
  layout?: "stack" | "columns";
}) {
  const onRename = overrides?.onRename ?? vi.fn();
  const onDuplicate = vi.fn();
  const onDelete = vi.fn();
  const onEditDetail = overrides?.onEditDetail ?? vi.fn();
  const onClose = vi.fn();
  const actions: ItemAction[] = [
    {
      id: "rename",
      label: "Rename",
      inlineInput: { value: "Gym", ariaLabel: "Rename", onCommit: onRename },
    },
    { id: "duplicate", label: "Duplicate", onSelect: onDuplicate },
    { id: "delete", label: "Delete", danger: true, onSelect: onDelete },
  ];
  render(
    <ItemActionPopover
      position={{ x: 100, y: 100 }}
      summary={<p>Gym · 09:00–10:00</p>}
      actions={actions}
      onEditDetail={onEditDetail}
      editDetailLabel="Edit detail"
      label="Item actions"
      onClose={onClose}
      layout={overrides?.layout}
    />,
  );
  return { onRename, onDuplicate, onDelete, onEditDetail, onClose };
}

describe("ItemActionPopover unified panel (#551)", () => {
  it("renders summary, the action rows and the edit-detail hand-off", () => {
    renderPopover();
    expect(screen.getByText("Gym · 09:00–10:00")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Rename" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Duplicate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit detail" }),
    ).toBeInTheDocument();
  });

  it("fires onSelect + onClose for a plain action", () => {
    const { onDuplicate, onClose } = renderPopover();
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires onEditDetail + onClose from the primary button", () => {
    const { onEditDetail, onClose } = renderPopover();
    fireEvent.click(screen.getByRole("button", { name: "Edit detail" }));
    expect(onEditDetail).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("swaps to a seeded input on Rename and hides the edit-detail button", () => {
    renderPopover();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(screen.getByRole("textbox", { name: "Rename" })).toHaveValue("Gym");
    // Enter must have exactly one meaning while the input is up.
    expect(screen.queryByRole("button", { name: "Edit detail" })).toBeNull();
  });

  it("commits the trimmed title + onClose on Enter", () => {
    const { onRename, onClose } = renderPopover();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename" });
    fireEvent.change(input, { target: { value: "  Yoga  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("Yoga");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes without committing when the draft is blank", () => {
    const { onRename, onClose } = renderPopover();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not commit while an IME composition is active", () => {
    const { onRename, onClose } = renderPopover();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename" });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onRename).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels rename (onClose, no commit) on Escape in the input", () => {
    const { onRename, onClose } = renderPopover();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename" });
    fireEvent.change(input, { target: { value: "changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRename).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a document-level Escape", () => {
    const { onClose } = renderPopover();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on an outside mousedown", () => {
    const { onClose } = renderPopover();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/*
 * #1625 — the two-column arrangement Schedule opts into. The stacked default
 * above is what the tour and every other caller keep, so these cases pin the
 * split itself: the item on the left with its detail hand-off, the actions on
 * the right, and the rename swap staying inside the actions column.
 */
describe("ItemActionPopover columns layout (#1625)", () => {
  function column(name: "summary" | "actions"): HTMLElement {
    const el = screen
      .getByRole("dialog", { name: "Item actions" })
      .querySelector(`[data-item-panel-column="${name}"]`);
    expect(el).not.toBeNull();
    return el as HTMLElement;
  }

  it("puts the summary and edit-detail left and the actions right", () => {
    renderPopover({ layout: "columns" });
    const summary = column("summary");
    const actions = column("actions");
    expect(summary).toHaveTextContent("Gym · 09:00–10:00");
    expect(
      summary.querySelector("button")?.textContent,
    ).toContain("Edit detail");
    for (const name of ["Rename", "Duplicate", "Delete"]) {
      expect(actions).toContainElement(
        screen.getByRole("menuitem", { name }),
      );
    }
  });

  it("keeps the rename input in the actions column and hides edit-detail", () => {
    renderPopover({ layout: "columns" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(column("actions")).toContainElement(
      screen.getByRole("textbox", { name: "Rename" }),
    );
    expect(screen.queryByRole("button", { name: "Edit detail" })).toBeNull();
    // The summary still says which item is being renamed.
    expect(column("summary")).toHaveTextContent("Gym · 09:00–10:00");
  });

  it("draws no columns for the stacked default", () => {
    renderPopover();
    expect(
      screen
        .getByRole("dialog", { name: "Item actions" })
        .querySelector("[data-item-panel-column]"),
    ).toBeNull();
  });
});
