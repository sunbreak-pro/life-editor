import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NarrowHeaderRow } from "../src/NarrowHeaderRow";
import { SECTION_DESCRIPTORS } from "../src/sectionDescriptors";

/*
 * #1033 — narrow Schedule draws ONE hamburger, and the shell draws it.
 *
 * Before this, Schedule was the only section on the `tabs` shape: the shell
 * skipped the hamburger, and CalendarTab hand-rolled a second one inside the
 * month heading row. Same control, same component, two different places
 * depending on which section you were looking at.
 *
 * The arrival half renders for real — `NarrowHeaderRow` (#1035) reads no
 * context, so the descriptor's own shape can be fed straight into it and the
 * resulting DOM order asserted.
 *
 * The departure half — "the hamburger left the date row" — renders the host
 * and lives in scheduleNarrowHost.test.tsx (#1642 P1; it used to be source
 * text read here).
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

describe("narrow Schedule hamburger (#1033)", () => {
  it("asks the shell for the hamburger + tabs row", () => {
    expect(SECTION_DESCRIPTORS.schedule.narrowHeader).toBe("tabs+hamburger");
  });

  it("leaves no section on the tabs-alone shape", () => {
    // The shape itself stays in the union (removing it is a separate call),
    // but nothing may quietly re-adopt it: that is the state in which a
    // section has tabs, no hamburger, and a reason to hand-roll one.
    const tabsOnly = Object.entries(SECTION_DESCRIPTORS)
      .filter(([, d]) => d.narrowHeader === "tabs")
      .map(([id]) => id);
    expect(tabsOnly).toEqual([]);
  });

  it("draws the hamburger to the left of the tabs", () => {
    // The shape is read from the descriptor rather than retyped, so this case
    // follows Schedule wherever the table moves it.
    render(
      <NarrowHeaderRow
        shape={SECTION_DESCRIPTORS.schedule.narrowHeader}
        tabs={<button type="button">tabs</button>}
        hamburger={<button type="button">hamburger</button>}
        actions={<button type="button">undo</button>}
      />,
    );
    const order = screen
      .getAllByRole("button")
      .map((b) => b.textContent)
      .join(",");
    expect(order).toBe("hamburger,tabs,undo");
  });
});
