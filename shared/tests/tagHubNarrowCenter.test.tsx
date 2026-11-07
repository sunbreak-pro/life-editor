import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  RightSidebar,
  RightSidebarToggle,
  TagHubEditBlock,
  TagHubItemGroups,
  type TagHubGroup,
  type TagHubTagSummary,
} from "../src/components";
import { RightSidebarProvider } from "../src/context";
import { TAG_HUB_LABELS } from "./tagHubLabels";

/*
 * #2496 — on a 1280px window, widening the right panel left Connect's detail
 * column ~250px wide: the tag editor's labels folded letter by letter, and a
 * row's title was 3–4 characters with the Done chip on the frame's clipped
 * edge.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so the widths are checked in a real
 * browser. What is pinned here is the structure that decides them:
 *   1. the panel stops where <main> would drop under its floor,
 *   2. the editor is one column, labels above fields (#2603 made it so at
 *      every width),
 *   3. nothing in the editor's buttons or footer breaks a line,
 *   4. a cramped Desktop row moves its day under the title — and a phone's
 *      row is left exactly as it was.
 */

const classesOf = (el: Element): string[] =>
  el.getAttribute("class")?.split(/\s+/).filter(Boolean) ?? [];

const WORK: TagHubTagSummary = {
  id: "t-work",
  name: "Work",
  color: null,
  icon: null,
  count: 2,
  isUntagged: false,
};

beforeEach(cleanup);

describe("right panel — <main> keeps a floor (#2496)", () => {
  it("caps the panel at the row's width minus 520px, never under its own 240px", () => {
    render(
      <RightSidebarProvider>
        <RightSidebarToggle
          variant="panel"
          openLabel="Open details"
          closeLabel="Hide details"
        />
        <RightSidebar
          title="Details"
          emptyLabel="Nothing yet"
          resizeLabel="Resize"
        />
      </RightSidebarProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    const panel = screen.getByRole("complementary", { name: "Details" });
    expect(classesOf(panel)).toContain("max-w-[max(240px,calc(100%_-_520px))]");
  });
});

describe("tag editor — folds into one column instead of squeezing (#2496)", () => {
  function renderBlock(dirty = false): HTMLElement {
    render(
      <TagHubEditBlock
        tag={WORK}
        edits={dirty ? { name: "Work 2" } : {}}
        dirty={dirty}
        onEdit={vi.fn()}
        onDropEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        labels={TAG_HUB_LABELS.edit}
      />,
    );
    const block = document.querySelector("[data-taghub-edit]");
    if (!(block instanceof HTMLElement)) throw new Error("no edit block");
    return block;
  }

  // #2603 then made one column the only layout: a label above its field
  // needs no container query to decide when to stack.
  it("is one column at every width, with no container query left", () => {
    const block = renderBlock();
    expect(classesOf(block)).not.toContain("@container");
    const fields = block.querySelector("[data-taghub-edit-fields]");
    expect(fields?.parentElement).toBe(block);
    const classes = classesOf(fields as Element);
    expect(classes).toContain("flex-col");
    expect(classes.some((c) => c.includes("grid-cols"))).toBe(false);
  });

  it("never breaks a button label, and wraps the footer row instead", () => {
    renderBlock(true);
    const L = TAG_HUB_LABELS.edit;
    const noWrap = (el: Element | null) =>
      expect(classesOf(el as Element)).toContain("whitespace-nowrap");

    noWrap(screen.getByRole("button", { name: L.iconMore }));
    noWrap(screen.getByRole("button", { name: L.colorDefault }));
    noWrap(screen.getByLabelText(L.colorCustom).closest("label"));
    noWrap(screen.getByRole("button", { name: L.deleteTag }));
    noWrap(screen.getByRole("button", { name: L.save }));
    noWrap(screen.getByRole("button", { name: L.cancel }));

    const footer = document.querySelector("[data-taghub-edit-footer]");
    expect(classesOf(footer as Element)).toContain("flex-wrap");
    // The save side stays on the right once it drops to a line of its own.
    const saveSide = screen.getByRole("button", { name: L.save }).parentElement;
    expect(classesOf(saveSide as Element)).toContain("ml-auto");
  });
});

describe("item rows — a cramped Desktop frame goes to two lines (#2496)", () => {
  const GROUPS: readonly TagHubGroup[] = [
    {
      role: "task",
      items: [
        {
          id: "task-done",
          role: "task",
          title: "Write the plan",
          dayKey: "2026-11-02",
          time: "09:30",
          status: "DONE",
        },
      ],
    },
  ];

  function renderRows(wide: boolean) {
    render(
      <TagHubItemGroups
        groups={GROUPS}
        onOpenItem={vi.fn()}
        formatCount={(n) => `${n} items`}
        wide={wide}
        labels={TAG_HUB_LABELS}
        onToggleTodoStatus={vi.fn()}
      />,
    );
    const frame = document.querySelector("section[data-taghub-group]")!;
    const row = document.querySelector('[data-taghub-row="task-done"]')!;
    return {
      frame,
      button: row.querySelector("[data-taghub-when]")!.closest("button")!,
      when: row.querySelector("[data-taghub-when]")!,
      title: row.querySelector("[data-taghub-title]")!,
      done: row.querySelector("[data-taghub-done]")!,
    };
  }

  it("puts the title on a line of its own and the day and chip under it", () => {
    const { frame, button, when, title, done } = renderRows(true);
    expect(classesOf(frame)).toContain("@container");
    expect(classesOf(button)).toContain("@max-[20rem]:flex-wrap");
    expect(classesOf(title)).toContain("@max-[20rem]:basis-full");
    // The day leaves its fixed column and follows the title.
    expect(classesOf(when)).toEqual(
      expect.arrayContaining([
        "@max-[20rem]:order-2",
        "@max-[20rem]:w-auto",
        "@max-[20rem]:flex-row",
      ]),
    );
    expect(classesOf(done)).toContain("@max-[20rem]:order-3");
    // Order only: the DOM keeps day → title → chip, so the name is unchanged.
    expect(button.getAttribute("aria-label")).toBe(
      "Write the plan, 2026-11-02, 09:30, Done",
    );
  });

  it("leaves the phone's row as it was", () => {
    const { frame, button, when, title, done } = renderRows(false);
    for (const el of [frame, button, when, title, done]) {
      expect(classesOf(el).filter((c) => c.startsWith("@"))).toEqual([]);
    }
    // The phone already reads the day under the title (#2498).
    expect(when.closest("[data-taghub-meta]")).not.toBeNull();
  });
});
