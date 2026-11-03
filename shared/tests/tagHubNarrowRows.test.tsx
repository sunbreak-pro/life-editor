import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import { TagHubItemGroups, type TagHubGroup } from "../src/components";
import { TAG_HUB_LABELS as LABELS, formatCount } from "./tagHubLabels";

/*
 * #2498 — on a 390px phone the row's fixed 4.5rem day column, the Done chip
 * and the hidden chevron left a todo's title 37px: three letters.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so the fix is pinned as STRUCTURE:
 * on narrow the day and the Done chip sit in a line under the title, inside
 * the title's own column; on wide they keep the left edge and the right of
 * the title exactly as before. The widths themselves are checked in a real
 * browser.
 */

const GROUPS: TagHubGroup[] = [
  {
    role: "task",
    items: [
      {
        id: "task-done",
        role: "task",
        title: "Ship the release notes for the autumn update",
        status: "DONE",
        dayKey: "2026-08-29",
        time: "09:30",
      },
      { id: "task-undated", role: "task", title: "Someday" },
    ],
  },
  {
    role: "note",
    items: [
      {
        id: "note-1",
        role: "note",
        title: "Migration notes",
        detail: "What moved where",
        dayKey: "2026-08-27",
        time: "14:05",
      },
    ],
  },
];

function renderRows(wide: boolean) {
  render(
    <TagHubItemGroups
      groups={GROUPS}
      onOpenItem={vi.fn()}
      formatCount={formatCount}
      wide={wide}
      labels={LABELS}
      onItemMenu={wide ? undefined : vi.fn()}
      formatItemMenu={(title) => `${title}: Item actions`}
      onSelectItem={wide ? vi.fn() : undefined}
      formatOpenItem={(title) => `Open “${title}”`}
      onToggleTodoStatus={vi.fn()}
    />,
  );
}

const row = (id: string): HTMLElement => {
  const el = document.querySelector(`[data-taghub-row="${id}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`no row ${id}`);
  return el;
};

/** The span holding the title and whatever sits under it. */
const titleColumn = (id: string): HTMLElement => {
  const title = within(row(id)).getByTitle(
    GROUPS.flatMap((g) => g.items).find((i) => i.id === id)!.title,
  );
  const column = title.parentElement;
  if (!column) throw new Error(`no title column on ${id}`);
  return column;
};

beforeEach(() => {
  cleanup();
});

describe("TagHubItemGroups — narrow rows give the title the width (#2498)", () => {
  it("puts the day and time under the title, inside its column", () => {
    renderRows(false);
    for (const id of ["task-done", "task-undated", "note-1"]) {
      const when = row(id).querySelector("[data-taghub-when]");
      if (!when) throw new Error(`no day on ${id}`);
      // Inside the title's column, under the title — not a column of its own.
      expect(titleColumn(id).contains(when)).toBe(true);
      expect(when.closest("[data-taghub-meta]")).not.toBeNull();
      expect(when.className).not.toContain("w-[4.5rem]");
      // The title comes first in its column.
      expect(titleColumn(id).firstElementChild?.getAttribute("title")).toBe(
        GROUPS.flatMap((g) => g.items).find((i) => i.id === id)!.title,
      );
    }
    // The same day and time are still there.
    const doneWhen = row("task-done").querySelector("[data-taghub-when]");
    expect(doneWhen?.textContent).toContain("2026-08-29");
    expect(doneWhen?.textContent).toContain("09:30");
    expect(
      row("task-undated").querySelector("[data-taghub-when]")?.textContent,
    ).toBe("No date");
    // A note's excerpt still reads under it.
    expect(within(titleColumn("note-1")).getByText("What moved where")).toBe(
      within(row("note-1")).getByText("What moved where"),
    );
  });

  it("moves the Done chip into that line too", () => {
    renderRows(false);
    const chip = within(row("task-done")).getByText("Done");
    expect(chip.closest("[data-taghub-meta]")).not.toBeNull();
    expect(titleColumn("task-done").contains(chip)).toBe(true);
    expect(within(row("task-undated")).queryByText("Done")).toBeNull();
  });

  it("keeps the 44px row, the “…” button and a visible chevron", () => {
    renderRows(false);
    const r = row("task-done");
    const rowButton = r.querySelector("[data-taghub-when]")?.closest("button");
    expect(rowButton?.className).toContain("min-h-11");
    const menu = within(r).getByRole("button", {
      name: "Ship the release notes for the autumn update: Item actions",
    });
    expect(menu.className).toContain("size-11");
    // A phone has no hover: the chevron is drawn, not hover-revealed.
    const chevron = rowButton?.querySelector("svg.lucide-chevron-right");
    expect(chevron).not.toBeNull();
    expect(chevron?.getAttribute("class")).not.toContain("opacity-0");
    // The row's name still carries the day, the time and Done.
    expect(rowButton?.getAttribute("aria-label")).toBe(
      "Ship the release notes for the autumn update, 2026-08-29, 09:30, Done",
    );
  });
});

describe("TagHubItemGroups — wide rows are unchanged (#2498)", () => {
  it("keeps the fixed day column at the left edge", () => {
    renderRows(true);
    for (const id of ["task-done", "task-undated", "note-1"]) {
      const when = row(id).querySelector("[data-taghub-when]");
      if (!when) throw new Error(`no day on ${id}`);
      expect(when.className).toContain("w-[4.5rem]");
      expect(titleColumn(id).contains(when)).toBe(false);
    }
    expect(document.querySelector("[data-taghub-meta]")).toBeNull();
  });

  it("keeps the Done chip right of the title", () => {
    renderRows(true);
    const chip = within(row("task-done")).getByText("Done");
    expect(titleColumn("task-done").contains(chip)).toBe(false);
    expect(chip.parentElement?.tagName).toBe("BUTTON");
  });
});
