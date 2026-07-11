import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScheduleItemContextMenu } from "../src/components";

/*
 * ScheduleItemContextMenu (#223) — right-click menu for a calendar item.
 * Verifies the three actions (rename / duplicate / delete), the inline rename
 * mode (Enter commits, Escape cancels), and outside/Escape close.
 */

const LABELS = {
  rename: "Rename",
  duplicate: "Duplicate",
  delete: "Delete",
};

function renderMenu(
  props?: Partial<Parameters<typeof ScheduleItemContextMenu>[0]>,
) {
  const onRename = vi.fn();
  const onDuplicate = vi.fn();
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(
    <ScheduleItemContextMenu
      position={{ x: 100, y: 100 }}
      currentTitle="Gym"
      labels={LABELS}
      onRename={onRename}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onClose={onClose}
      {...props}
    />,
  );
  return { onRename, onDuplicate, onDelete, onClose };
}

describe("ScheduleItemContextMenu", () => {
  it("renders the three action rows", () => {
    renderMenu();
    expect(
      screen.getByRole("menuitem", { name: "Rename" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Duplicate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();
  });

  it("fires onDuplicate + onClose when Duplicate is clicked", () => {
    const { onDuplicate, onClose } = renderMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires onDelete + onClose when Delete is clicked", () => {
    const { onDelete, onClose } = renderMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("switches to an inline input seeded with the title on Rename", () => {
    renderMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename" });
    expect(input).toHaveValue("Gym");
  });

  it("commits the trimmed title with onRename + onClose on Enter", () => {
    const { onRename, onClose } = renderMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename" });
    fireEvent.change(input, { target: { value: "  Yoga  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("Yoga");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not commit while an IME composition is active", () => {
    const { onRename, onClose } = renderMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename" });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onRename).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels rename (onClose, no onRename) on Escape in the input", () => {
    const { onRename, onClose } = renderMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename" });
    fireEvent.change(input, { target: { value: "changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRename).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a document-level Escape", () => {
    const { onClose } = renderMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on an outside mousedown", () => {
    const { onClose } = renderMenu();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
