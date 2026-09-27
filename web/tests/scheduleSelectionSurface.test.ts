import { describe, it, expect, vi } from "vitest";
import type { ScheduleItem } from "@life-editor/shared";
import {
  scheduleItemById,
  selectionSurface,
} from "../src/schedule/scheduleSelectionSurface";

/*
 * #1642 P10 (M-06 / M-07): the layout rule about selection and the id lookup,
 * each spelled once. The overlay host, the create flow and the todo-chip tap
 * all read the rule from here now, so this pins what each answer is on both
 * layouts.
 */

describe("selectionSurface", () => {
  it("on Desktop: the selection is a ring and the editor is its own overlay", () => {
    const desktop = selectionSurface(true);
    expect(desktop.selectionIsSheet).toBe(false);
    expect(desktop.editorOpen(true, false)).toBe(false);
    expect(desktop.editorOpen(true, true)).toBe(true);
    expect(desktop.editorOpen(false, true)).toBe(false);
    expect(desktop.createSelects).toBe(true);
    expect(desktop.openNeedsOverlay).toBe(true);
  });

  it("on narrow: the selection IS the sheet", () => {
    const narrow = selectionSurface(false);
    expect(narrow.selectionIsSheet).toBe(true);
    expect(narrow.editorOpen(true, false)).toBe(true);
    expect(narrow.editorOpen(false, true)).toBe(false);
    // A plain create selecting would open the sheet.
    expect(narrow.createSelects).toBe(false);
    expect(narrow.openNeedsOverlay).toBe(false);
  });

  it("closes the overlay on Desktop and the selection on narrow", () => {
    for (const [isWide, expected] of [
      [true, "closeOverlay"],
      [false, "clearSelection"],
    ] as const) {
      const handlers = { closeOverlay: vi.fn(), clearSelection: vi.fn() };
      selectionSurface(isWide).closeEditor(handlers);
      expect(handlers[expected]).toHaveBeenCalledTimes(1);
      expect(
        Object.values(handlers).filter((h) => h.mock.calls.length > 0),
      ).toHaveLength(1);
    }
  });
});

describe("scheduleItemById", () => {
  const row = (id: string, title: string) =>
    ({ id, title }) as unknown as ScheduleItem;

  it("reads the visible range first, then the context rows", () => {
    const range = [row("a", "range copy")];
    const context = [row("a", "context copy"), row("b", "context only")];

    expect(scheduleItemById("a", range, context)?.title).toBe("range copy");
    expect(scheduleItemById("b", range, context)?.title).toBe("context only");
    expect(scheduleItemById("c", range, context)).toBeUndefined();
  });
});
