import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UndoRedoButtons } from "../src/components";

/*
 * #2216 — the undo / redo pair always draws its border, and a disabled
 * button keeps it. Only the glyph's colour steps down: the old `opacity-40`
 * faded the border with everything else, so a pair with no history looked
 * absent rather than idle. jsdom has no stylesheet, so the contract is held
 * at the class level (rules/frontend.md §テスト環境の制約).
 */

function renderPair(canUndo: boolean, canRedo: boolean) {
  render(
    <UndoRedoButtons
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={() => {}}
      onRedo={() => {}}
      undoLabel="Undo"
      redoLabel="Redo"
    />,
  );
  return {
    undo: screen.getByRole("button", { name: "Undo" }),
    redo: screen.getByRole("button", { name: "Redo" }),
  };
}

describe("UndoRedoButtons border (#2216)", () => {
  it("draws the strong border on both buttons while enabled", () => {
    const { undo, redo } = renderPair(true, true);
    for (const btn of [undo, redo]) {
      expect(btn).not.toBeDisabled();
      expect(btn.classList.contains("border")).toBe(true);
      expect(btn.classList.contains("border-lumen-border-strong")).toBe(true);
    }
  });

  it("keeps the border when disabled and dims only the colour", () => {
    const { undo, redo } = renderPair(false, false);
    for (const btn of [undo, redo]) {
      expect(btn).toBeDisabled();
      expect(btn.classList.contains("border")).toBe(true);
      expect(btn.classList.contains("border-lumen-border-strong")).toBe(true);
      expect(btn.classList.contains("disabled:text-lumen-text-tertiary")).toBe(
        true,
      );
      // Fading the whole box would take the border down with it.
      expect(btn.className).not.toContain("opacity-");
    }
  });
});
