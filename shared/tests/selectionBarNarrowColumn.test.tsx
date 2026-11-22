import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  within,
  fireEvent,
} from "@testing-library/react";
import {
  TagHubSelectionBar,
  ToastViewport,
  type TagHubSelectionBarLabels,
  type TagHubTagSummary,
} from "../src/components";

/*
 * What the Step 12 browser pass caught (#1732 / #1733).
 *
 * jsdom has no layout, so neither bug can be re-measured here (CLAUDE.md
 * §7.1) — both cases pin the CLASS CONTRACT that produces the fix, the same
 * way the #1561 touch-floor suite does.
 *
 * #1732: with the right panel open the items pane is 590px, and the bar broke
 * two ways — English wrapped a button's label onto a second line and it spilled
 * out of the pill, Japanese truncated "2 件を選択中" to "2 …". No label in the
 * bar may shrink or wrap; whole buttons flow onto further lines instead
 * (#2601 — the strip used to scroll sideways and cut the last one in half).
 *
 * #1733: a bottom-anchored toast stack sat on top of the Mobile tab bar and
 * hid its labels.
 */

const TAGS: TagHubTagSummary[] = [
  {
    id: "t-work",
    name: "Work",
    color: null,
    icon: null,
    count: 3,
    isUntagged: false,
  },
  {
    id: "t-idle",
    name: "Idle",
    color: null,
    icon: null,
    count: 0,
    isUntagged: false,
  },
];

const LABELS: TagHubSelectionBarLabels = {
  region: "Selected items",
  assign: "Add a tag",
  remove: "Remove this tag",
  move: "Move to another tag",
  clear: "Clear selection",
  assignTitle: "Add a tag to the selection",
  moveTitle: "Move the selection to a tag",
  picker: {
    search: "Search or create a tag…",
    formatCreate: (name) => `Create “${name}”`,
    empty: "No matching tag",
  },
};

function renderBar(layout: "row" | "rail" = "row") {
  render(
    <TagHubSelectionBar
      count={2}
      formatSelected={(count) => `${count} 件を選択中`}
      tags={TAGS}
      currentTagId="t-work"
      canRemove
      onAssign={vi.fn()}
      onCreateAndAssign={vi.fn()}
      onRemove={vi.fn()}
      onMove={vi.fn()}
      onClear={vi.fn()}
      labels={LABELS}
      layout={layout}
    />,
  );
  return screen.getByRole("toolbar", { name: "Selected items" });
}

beforeEach(cleanup);

describe("TagHubSelectionBar — a narrow items column (#1732)", () => {
  it("never truncates the count", () => {
    const bar = renderBar();
    const count = within(bar).getByText("2 件を選択中");

    // `truncate` is what clipped the Japanese copy to "2 …".
    expect(count.className).not.toContain("truncate");
    expect(count).toHaveClass("shrink-0", "whitespace-nowrap");
  });

  it("keeps every action's label on one line, at its own width", () => {
    const bar = renderBar();
    for (const name of [
      "Add a tag",
      "Remove this tag",
      "Move to another tag",
      "Clear selection",
    ]) {
      const button = within(bar).getByRole("button", {
        name: new RegExp(name),
      });
      // Shrinking is what forced the English labels onto a second line, which
      // then overflowed the 32px pill.
      expect(button).toHaveClass("shrink-0", "whitespace-nowrap");
    }
  });

  it("flows its buttons onto further lines, under the count (#2601)", () => {
    const bar = renderBar();
    expect(bar).not.toHaveClass("overflow-x-auto");
    // A fixed height would clip the second line of buttons.
    expect(bar.className).not.toMatch(/(^| )h-/);

    const actions = bar.querySelector("[data-taghub-selection-actions]");
    if (!(actions instanceof HTMLElement)) throw new Error("no actions");
    expect(actions).toHaveClass("flex-wrap");
    expect(within(actions).getAllByRole("button")).toHaveLength(3);

    const top = actions.previousElementSibling;
    if (!(top instanceof HTMLElement)) throw new Error("no top line");
    within(top).getByText("2 件を選択中");
    within(top).getByRole("button", { name: "Clear selection" });
  });
});

describe("TagHubSelectionBar — three writes, one weight (#2601)", () => {
  it.each(["row", "rail"] as const)(
    "orders add, move, remove and leads each with its glyph (%s)",
    (layout) => {
      const bar = renderBar(layout);
      const writes = within(bar)
        .getAllByRole("button")
        .filter((button) => button.textContent !== "Clear selection");
      expect(writes.map((button) => button.textContent)).toEqual([
        "Add a tag",
        "Move to another tag",
        "Remove this tag",
      ]);
      // One glyph each, before the label — and no chevron after it.
      expect(
        writes.map((button) =>
          [...button.querySelectorAll("svg")].map(
            (svg) => [...svg.classList].filter((c) => c !== "lucide")[0],
          ),
        ),
      ).toEqual([["lucide-tag"], ["lucide-arrow-right-left"], ["lucide-x"]]);
      for (const button of writes) {
        expect(button.firstElementChild?.tagName).toBe("svg");
        expect(button).toHaveClass("bg-lumen-bg-secondary", "border");
        expect(button).not.toHaveClass("bg-lumen-accent");
        // The 44px floor (#1561) holds on every one.
        expect(button).toHaveClass("max-md:min-h-11");
      }
    },
  );
});

describe("TagHubSelectionBar — the choosers escape the bar (#1845)", () => {
  // The bar used to scroll sideways, which made it clip vertically too: a
  // chooser opened inside it showed as a 2px sliver. Both must live outside.
  it.each([
    ["Add a tag", "Add a tag to the selection"],
    ["Move to another tag", "Move the selection to a tag"],
  ])("opens %s outside the toolbar", (trigger, title) => {
    const bar = renderBar();
    fireEvent.click(within(bar).getByRole("button", { name: trigger }));

    const dialog = screen.getByRole("dialog", { name: title });
    expect(bar.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass("fixed");
    // Measured from the trigger, so it is placed (not hidden) once open.
    expect(dialog.style.visibility).not.toBe("hidden");
  });

  it("still closes on Esc without clearing the selection", () => {
    const onClear = vi.fn();
    render(
      <TagHubSelectionBar
        count={2}
        formatSelected={(count) => `${count} selected`}
        tags={TAGS}
        currentTagId="t-work"
        canRemove
        onAssign={vi.fn()}
        onCreateAndAssign={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
        onClear={onClear}
        labels={LABELS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add a tag" }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onClear).not.toHaveBeenCalled();
  });
});

describe("ToastViewport — above the Mobile tab bar (#1733)", () => {
  it("lifts a bottom stack clear of the tabs on narrow only", () => {
    render(
      <ToastViewport position="bottom-right" data-testid="viewport">
        <div>toast</div>
      </ToastViewport>,
    );
    const viewport = screen.getByTestId("viewport");

    // Desktop keeps its flush-to-the-edge anchor…
    expect(viewport).toHaveClass("bottom-0");
    // …and narrow clears the tab bar plus the safe area.
    expect(viewport.className).toContain(
      "max-md:bottom-[calc(3.75rem+env(safe-area-inset-bottom))]",
    );
  });

  it("leaves a top-anchored stack alone", () => {
    render(
      <ToastViewport position="top-center" data-testid="viewport">
        <div>toast</div>
      </ToastViewport>,
    );
    expect(screen.getByTestId("viewport").className).not.toContain(
      "max-md:bottom-",
    );
  });
});
