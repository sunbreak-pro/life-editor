import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NarrowHeaderRow } from "../src/NarrowHeaderRow";
import {
  SECTION_DESCRIPTORS,
  type NarrowHeader,
} from "../src/sectionDescriptors";

/*
 * #1035 — Undo/Redo on every narrow section header.
 *
 * The claim under test is "every section", so the interesting cases are the
 * shape that used to render NO row at all (`none` = Analytics / Trash) and the
 * one with no hamburger to sit opposite (`tabs` = Schedule). Asserted on the
 * row component rather than through MainScreen, which needs a DataService and
 * the whole Provider stack to mount (rules/frontend.md §テスト環境の制約).
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

const SHAPES: NarrowHeader[] = ["none", "hamburger", "tabs", "tabs+hamburger"];

function renderRow(shape: NarrowHeader, withTabs = true) {
  render(
    <NarrowHeaderRow
      shape={shape}
      tabs={
        withTabs ? (
          <button type="button" className="flex-1">
            tabs
          </button>
        ) : undefined
      }
      hamburger={<button type="button">hamburger</button>}
      actions={<button type="button">undo</button>}
    />,
  );
}

describe("NarrowHeaderRow", () => {
  it.each(SHAPES)("draws the global actions at shape=%s", (shape) => {
    renderRow(shape);
    screen.getByRole("button", { name: "undo" });
  });

  it("draws a row for the sections that contribute no chrome of their own", () => {
    renderRow("none");
    expect(screen.queryByRole("button", { name: "hamburger" })).toBeNull();
    expect(screen.queryByRole("button", { name: "tabs" })).toBeNull();
    screen.getByRole("button", { name: "undo" });
  });

  it("keeps the per-section chrome each shape asked for", () => {
    renderRow("hamburger");
    screen.getByRole("button", { name: "hamburger" });
    expect(screen.queryByRole("button", { name: "tabs" })).toBeNull();
  });

  it("puts the tab band between the hamburger and the actions", () => {
    renderRow("tabs+hamburger");
    const order = screen
      .getAllByRole("button")
      .map((b) => b.textContent)
      .join(",");
    expect(order).toBe("hamburger,tabs,undo");
  });

  it("keeps the actions at the right edge when a shape has no tabs", () => {
    // Without the spacer the actions would slide left against the hamburger.
    renderRow("hamburger");
    const row = screen.getByRole("button", { name: "undo" })
      .parentElement as HTMLElement;
    const spacers = Array.from(row.children).filter((el) =>
      el.classList.contains("flex-1"),
    );
    expect(spacers).toHaveLength(1);
  });

  it("falls back to the spacer rather than a half-drawn row without a band", () => {
    renderRow("tabs", false);
    expect(screen.queryByRole("button", { name: "tabs" })).toBeNull();
    screen.getByRole("button", { name: "undo" });
  });

  it("covers every shape the descriptor table actually declares", () => {
    // Guards the it.each list above: a new NarrowHeader value reaching a
    // descriptor without a case here would otherwise go untested.
    const declared = new Set(
      Object.values(SECTION_DESCRIPTORS).map((d) => d.narrowHeader),
    );
    for (const shape of declared) expect(SHAPES).toContain(shape);
  });
});
