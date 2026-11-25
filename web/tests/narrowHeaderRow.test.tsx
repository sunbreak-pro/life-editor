import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  NarrowHeaderActionPortal,
  NarrowHeaderRow,
} from "../src/NarrowHeaderRow";
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

function renderRow(shape: NarrowHeader, withTabs = true, title?: string) {
  render(
    <NarrowHeaderRow
      shape={shape}
      title={title}
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

  /*
   * #1873 — Settings / Work had no heading of any level on narrow. The title
   * takes the spacer's place, and a tab band (which already names the screen)
   * wins over it.
   */
  it("names the screen with one heading when the shape has no tabs", () => {
    renderRow("hamburger", true, "Settings");
    const heading = screen.getByRole("heading", { name: "Settings" });
    expect(heading.classList.contains("flex-1")).toBe(true);
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("lets the tab band stand in for the title", () => {
    renderRow("tabs+hamburger", true, "Materials");
    expect(screen.queryByRole("heading")).toBeNull();
    screen.getByRole("button", { name: "tabs" });
  });

  it("keeps the actions at the right edge when a shape has no tabs", () => {
    // Without the spacer the actions would slide left against the hamburger.
    renderRow("hamburger");
    // The hamburger is a direct child of the row; the actions sit one level
    // down, in the box they share with the section slot (#2795).
    const row = screen.getByRole("button", { name: "hamburger" })
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

  /*
   * #2795 — a section body fills the slot right of the actions (the Notes
   * tab's "+"). The body and the row are separate trees in the shell, so they
   * are rendered side by side here, as PageContainer draws them.
   */
  describe("the section slot (#2795)", () => {
    it("draws a body's control after the actions, in the same gapless box", () => {
      render(
        <>
          <NarrowHeaderRow
            shape="tabs+hamburger"
            tabs={<div className="flex-1">tabs</div>}
            hamburger={<button type="button">hamburger</button>}
            actions={
              <>
                <button type="button">undo</button>
                <button type="button">redo</button>
              </>
            }
          />
          <main>
            <NarrowHeaderActionPortal>
              <button type="button">plus</button>
            </NarrowHeaderActionPortal>
          </main>
        </>,
      );
      const plus = screen.getByRole("button", { name: "plus" });
      expect(screen.getByRole("main").contains(plus)).toBe(false);
      const order = screen
        .getAllByRole("button")
        .map((b) => b.textContent)
        .join(",");
      expect(order).toBe("hamburger,undo,redo,plus");
      const box = screen.getByRole("button", { name: "redo" })
        .parentElement as HTMLElement;
      expect(box.contains(plus)).toBe(true);
      expect([...box.classList].some((c) => c.startsWith("gap-"))).toBe(false);
    });

    it("adds no box of its own while it is empty", () => {
      renderRow("tabs+hamburger");
      const slot = screen.getByTestId("narrow-header-action-slot");
      expect(slot.classList.contains("contents")).toBe(true);
      expect(slot.childElementCount).toBe(0);
    });

    it("draws the control in place when no narrow header is mounted", () => {
      render(
        <main>
          <NarrowHeaderActionPortal>
            <button type="button">plus</button>
          </NarrowHeaderActionPortal>
        </main>,
      );
      expect(
        screen
          .getByRole("main")
          .contains(screen.getByRole("button", { name: "plus" })),
      ).toBe(true);
    });

    it("takes the control away with the body that drew it", () => {
      const row = (
        <NarrowHeaderRow
          shape="tabs+hamburger"
          hamburger={<button type="button">hamburger</button>}
          actions={<button type="button">undo</button>}
        />
      );
      const { rerender } = render(
        <>
          {row}
          <NarrowHeaderActionPortal>
            <button type="button">plus</button>
          </NarrowHeaderActionPortal>
        </>,
      );
      screen.getByRole("button", { name: "plus" });
      rerender(<>{row}</>);
      expect(screen.queryByRole("button", { name: "plus" })).toBeNull();
    });
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
