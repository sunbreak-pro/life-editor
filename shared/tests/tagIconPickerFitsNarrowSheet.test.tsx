import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  BottomSheet,
  TagHubEditBlock,
  TagIconPicker,
  type TagHubTagSummary,
} from "../src/components";
import { TAG_HUB_LABELS } from "./tagHubLabels";

/*
 * #2051 — at 390px, the tag edit sheet scrolled sideways when the icon list
 * opened: the list's popover was `w-max` and hung ~30px past the sheet.
 * #2389 removed the popover. The icons the sheet shows are now a clipped
 * one-row strip, and the full list lives in a Modal that portals out of the
 * sheet, so the sheet has nothing left that can be wider than it.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so scrollWidth cannot be measured here.
 * What CAN be pinned is the chain of classes that keeps the sheet's content
 * inside the room it is given:
 *   1. the picker's root takes the host row's remaining width (min-w-0),
 *   2. the strip clips instead of growing a second row,
 *   3. nothing in the edit block carries an intrinsic or fixed width without a
 *      cap — with the panel closed AND open,
 *   4. the panel is not a descendant of the sheet at all.
 */

const LABELS = TAG_HUB_LABELS.edit;

const WORK: TagHubTagSummary = {
  id: "t-work",
  name: "Work",
  color: null,
  icon: null,
  count: 1,
  isUntagged: false,
};

const classesOf = (el: Element): string[] =>
  el.getAttribute("class")?.split(/\s+/).filter(Boolean) ?? [];

function renderStandalonePicker(): void {
  render(
    <TagIconPicker
      current={null}
      color={null}
      onPick={vi.fn()}
      labels={{
        iconLabel: LABELS.iconLabel,
        clearIconLabel: LABELS.iconClear,
        searchLabel: LABELS.iconSearch,
        noMatchLabel: LABELS.iconNoMatch,
        moreLabel: LABELS.iconMore,
        countLabel: LABELS.iconCount,
        closeLabel: LABELS.iconClose,
      }}
    />,
  );
}

function renderEditBlock(): HTMLElement {
  const { container } = render(
    <TagHubEditBlock
      tag={WORK}
      edits={{}}
      dirty={false}
      onEdit={vi.fn()}
      onDropEdit={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      onDelete={vi.fn()}
      labels={LABELS}
    />,
  );
  return container.firstElementChild as HTMLElement;
}

const strip = (): HTMLElement =>
  screen.getByRole("group", { name: LABELS.iconLabel });

beforeEach(cleanup);

describe("tag icon picker — the strip stays inside the room it is given (#2389)", () => {
  it("takes the host row's width and may shrink below its content", () => {
    renderStandalonePicker();
    const root = strip().parentElement!;

    // min-w-0 is what lets a flex item be narrower than its widest child; the
    // strip's own clip does the rest.
    expect(classesOf(root)).toContain("min-w-0");
    expect(classesOf(root)).toContain("flex-1");
  });

  it("clips to one row instead of wrapping past the sheet", () => {
    renderStandalonePicker();
    const classes = classesOf(strip());

    expect(classes).toContain("flex-wrap");
    expect(classes).toContain("overflow-hidden");
  });

  it("gives every glyph its own width, so it never squeezes under another", () => {
    renderStandalonePicker();

    // shrink-0 on the cells: without it a flex row compresses the buttons
    // instead of wrapping them, and the "one row" becomes a row of slivers.
    for (const cell of strip().children) {
      expect(classesOf(cell)).toContain("shrink-0");
    }
  });
});

describe("tag edit block — nothing in it sizes itself past the sheet (#2051)", () => {
  /** Widths that ignore the container: max-content, or a fixed arbitrary size. */
  const INTRINSIC_WIDTH = /^(?:min-)?w-(?:max|\[[^\]]+\])$/;

  function offendersIn(block: HTMLElement): string[] {
    const offenders: string[] = [];
    for (const el of [block, ...block.querySelectorAll("*")]) {
      const classes = classesOf(el);
      const intrinsic = classes.filter((c) => INTRINSIC_WIDTH.test(c));
      if (intrinsic.length === 0) continue;
      if (!classes.some((c) => c.startsWith("max-w-"))) {
        offenders.push(`<${el.tagName.toLowerCase()}> ${intrinsic.join(" ")}`);
      }
    }
    return offenders;
  }

  it("caps every intrinsic or fixed width, panel closed and open", () => {
    const block = renderEditBlock();
    expect(offendersIn(block)).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: LABELS.iconMore }));

    // Any one of these, uncapped, is wide enough at 390px to push the sheet's
    // scrollWidth past its clientWidth and cut "Delete tag" off.
    expect(offendersIn(block)).toEqual([]);
  });

  it("puts the picker in the icon row as a growing flex item", () => {
    renderEditBlock();
    const root = strip().parentElement!;
    const row = root.parentElement!;

    // flex-1 only takes the row's remaining width when the row is a flex box.
    expect(classesOf(row)).toContain("flex");
    expect(classesOf(root)).toContain("flex-1");
    // And the footer the old bug clipped is still drawn beside it.
    expect(
      screen.getByRole("button", { name: LABELS.deleteTag }),
    ).toBeInTheDocument();
  });
});

describe("tag icon picker inside a BottomSheet (#2389)", () => {
  it("opens the panel outside the sheet, so the sheet cannot clip it", () => {
    render(
      <BottomSheet open onClose={vi.fn()} title="Tag" closeLabel="Close">
        <TagHubEditBlock
          tag={WORK}
          edits={{}}
          dirty={false}
          onEdit={vi.fn()}
          onDropEdit={vi.fn()}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onDelete={vi.fn()}
          labels={LABELS}
        />
      </BottomSheet>,
    );
    const sheet = screen.getByRole("dialog", { name: "Tag" });

    fireEvent.click(screen.getByRole("button", { name: LABELS.iconMore }));
    const panel = screen.getByRole("dialog", { name: LABELS.iconLabel });

    // A descendant of the sheet would be cut off by the sheet's own overflow
    // and sit inside its stacking context; a portal child of <body> is neither.
    expect(sheet.contains(panel)).toBe(false);
    expect(panel.parentElement?.parentElement).toBe(document.body);
  });
});
