import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  TagHubEditBlock,
  TagIconPicker,
  type TagHubTagSummary,
} from "../src/components";
import { TAG_HUB_LABELS } from "./tagHubLabels";

/*
 * #2051 — at 390px, opening the icon list in the tag edit sheet (Materials'
 * sidebar, and Connect's narrow edit panel, which draw the same block) scrolled
 * the sheet sideways: the list's panel was `w-max`, so it grew to the frame's
 * 17rem wherever the trigger sat, and with the trigger ~105px in from the
 * sheet's edge its right side hung ~30px past it. "Delete tag" was cut off on
 * the left and a horizontal scrollbar appeared.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so the scrollWidth itself cannot be
 * measured here. What CAN be pinned is the chain of classes that keeps the
 * panel inside the room it is given:
 *   1. the picker's root (the panel's containing block) takes the host row's
 *      remaining width instead of the trigger's,
 *   2. the panel and its scroll frame are capped at 100% of that,
 *   3. the grid wraps to as many columns as fit, each at least one button wide,
 *      instead of squeezing a fixed 8 tracks under the buttons.
 * Drop any link and the panel either overruns the sheet again or paints
 * narrower than the icons sitting on it (#1289).
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

function openStandalonePicker(): HTMLElement {
  render(
    <TagIconPicker
      current={null}
      color={null}
      onPick={vi.fn()}
      triggerLabel={LABELS.iconChange}
      labels={{
        iconLabel: LABELS.iconLabel,
        clearIconLabel: LABELS.iconClear,
        searchLabel: LABELS.iconSearch,
        noMatchLabel: LABELS.iconNoMatch,
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: LABELS.iconLabel }));
  return screen.getByRole("group", { name: LABELS.iconLabel });
}

function openPickerInEditBlock(): { block: HTMLElement; popover: HTMLElement } {
  const { container } = render(
    <TagHubEditBlock
      tag={WORK}
      edits={{}}
      dirty={false}
      onEdit={vi.fn()}
      onDropEdit={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      labels={LABELS}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: LABELS.iconLabel }));
  return {
    block: container.firstElementChild as HTMLElement,
    popover: screen.getByRole("group", { name: LABELS.iconLabel }),
  };
}

beforeEach(cleanup);

describe("tag icon picker — the panel stays inside the room it is given (#2051)", () => {
  it("caps the panel's intrinsic width at its containing block", () => {
    const popover = openStandalonePicker();
    const classes = classesOf(popover);

    // `w-max` stays (#1289: without it the panel shrinks to the trigger), but
    // only with a cap beside it; alone it is what overran the sheet.
    expect(classes).toContain("w-max");
    expect(classes).toContain("max-w-full");
    expect(classes).toContain("absolute");
  });

  it("gives the panel the host row's width to be capped at, not the trigger's", () => {
    const popover = openStandalonePicker();
    const root = popover.parentElement!;
    const rootClasses = classesOf(root);

    // The root is the panel's containing block. Sized by the trigger
    // (`shrink-0`), 100% of it would be the trigger's ~80px again.
    expect(rootClasses).toContain("relative");
    expect(rootClasses).toContain("flex-1");
    expect(rootClasses).toContain("min-w-0");
    expect(rootClasses).not.toContain("shrink-0");

    // The trigger keeps its own size inside the wider root rather than
    // stretching into a full-row bar.
    const trigger = screen.getByRole("button", { name: LABELS.iconLabel });
    expect(classesOf(trigger)).toContain("w-fit");
  });

  it("lets the scroll frame give way when the panel is capped", () => {
    const popover = openStandalonePicker();
    const frame = popover.querySelector('[role="listbox"]')!.parentElement!;

    expect(classesOf(frame)).toContain("max-w-full");
  });

  it("wraps the grid to the columns that fit, each at least one button wide", () => {
    const popover = openStandalonePicker();
    const grid = popover.querySelector<HTMLElement>('[role="listbox"]')!;
    const gridClasses = classesOf(grid);

    // A fixed count is `repeat(n, minmax(0, 1fr))`: its tracks shrink to 0
    // and the 28px buttons spill out of them sideways.
    expect(gridClasses.filter((c) => /^grid-cols-\d+$/.test(c))).toEqual([]);
    expect(gridClasses).toContain(
      "grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))]",
    );

    // The track floor (1.75rem = 28px) is the button's width, so a track can
    // never be narrower than what sits in it.
    const option = screen.getAllByRole("option")[0];
    expect(classesOf(option)).toContain("w-7");
  });
});

describe("tag edit block — nothing in it sizes itself past the sheet (#2051)", () => {
  /** Widths that ignore the container: max-content, or a fixed arbitrary size. */
  const INTRINSIC_WIDTH = /^(?:min-)?w-(?:max|\[[^\]]+\])$/;

  it("caps every intrinsic or fixed width with the picker open", () => {
    const { block } = openPickerInEditBlock();
    const offenders: string[] = [];

    for (const el of [block, ...block.querySelectorAll("*")]) {
      const classes = classesOf(el);
      const intrinsic = classes.filter((c) => INTRINSIC_WIDTH.test(c));
      if (intrinsic.length === 0) continue;
      if (!classes.some((c) => c.startsWith("max-w-"))) {
        offenders.push(`<${el.tagName.toLowerCase()}> ${intrinsic.join(" ")}`);
      }
    }

    // Any one of these, uncapped, is wide enough at 390px to push the sheet's
    // scrollWidth past its clientWidth and cut "Delete tag" off.
    expect(offenders).toEqual([]);
  });

  it("puts the picker in the icon row as a growing flex item", () => {
    const { popover } = openPickerInEditBlock();
    const root = popover.parentElement!;
    const row = root.parentElement!;

    // flex-1 only takes the row's remaining width when the row is a flex box.
    expect(classesOf(row)).toContain("flex");
    expect(classesOf(root)).toContain("flex-1");
    // And the footer the bug clipped is still drawn beside it.
    expect(
      screen.getByRole("button", { name: LABELS.deleteTag }),
    ).toBeInTheDocument();
  });
});
