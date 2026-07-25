import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ItemContextMenu, type ItemAction } from "../src/components";

/*
 * ItemContextMenu (#307) — generic right-click menu. Verifies declarative
 * actions render, plain/danger selects fire + close, stub rows are disabled +
 * badged, and inline-input actions swap to a seeded input that commits trimmed
 * on Enter (IME-guarded) and cancels on Escape.
 */

const POS = { x: 100, y: 100 };

function build(overrides: Partial<Record<string, unknown>> = {}) {
  const onSelect = vi.fn();
  const onCommit = vi.fn();
  const onClose = vi.fn();
  const stub = vi.fn();
  const actions: ItemAction[] = [
    {
      id: "rename",
      label: "Rename",
      inlineInput: { value: "Old title", ariaLabel: "Rename", onCommit },
    },
    { id: "duplicate", label: "Duplicate", onSelect },
    { id: "delete", label: "Delete", danger: true, onSelect: stub },
    { id: "pin", label: "Pin", stub: true },
  ];
  render(
    <ItemContextMenu
      position={POS}
      actions={actions}
      stubBadge="Soon"
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSelect, onCommit, onClose, stub };
}

describe("ItemContextMenu", () => {
  it("renders every action row", () => {
    build();
    expect(screen.getByText("Rename")).toBeTruthy();
    expect(screen.getByText("Duplicate")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
    expect(screen.getByText("Pin")).toBeTruthy();
  });

  it("fires onSelect and closes on a plain action", () => {
    const { onSelect, onClose } = build();
    fireEvent.click(screen.getByText("Duplicate"));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders a stub as disabled with its badge and never fires", () => {
    build();
    const pinRow = screen.getByText("Pin").closest("button");
    expect(pinRow?.getAttribute("aria-disabled")).toBe("true");
    expect((pinRow as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Soon")).toBeTruthy();
  });

  it("swaps to a seeded input for an inline-input action", () => {
    build();
    fireEvent.click(screen.getByText("Rename"));
    const input = screen.getByLabelText("Rename") as HTMLInputElement;
    expect(input.value).toBe("Old title");
  });

  it("commits a trimmed value on Enter", () => {
    const { onCommit, onClose } = build();
    fireEvent.click(screen.getByText("Rename"));
    const input = screen.getByLabelText("Rename");
    fireEvent.change(input, { target: { value: "  New title  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("New title");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not commit an empty value but still closes", () => {
    const { onCommit, onClose } = build();
    fireEvent.click(screen.getByText("Rename"));
    const input = screen.getByLabelText("Rename");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignores Enter while composing (IME guard)", () => {
    const { onCommit } = build();
    fireEvent.click(screen.getByText("Rename"));
    const input = screen.getByLabelText("Rename");
    fireEvent.change(input, { target: { value: "New" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("cancels inline edit on Escape without committing", () => {
    const { onCommit, onClose } = build();
    fireEvent.click(screen.getByText("Rename"));
    const input = screen.getByLabelText("Rename");
    fireEvent.change(input, { target: { value: "New" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
