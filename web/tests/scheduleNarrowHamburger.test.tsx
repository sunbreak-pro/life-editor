import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
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
 * The departure half — "the hamburger left the date row" — is source text,
 * which no other schedule gate here does. It is the only option:
 * rules/frontend.md §テスト環境の制約 names CalendarTab as the screen jsdom
 * cannot carry (the full Provider chain plus real layout), and `useMediaQuery`
 * falls back to WIDE without a `matchMedia` stub, so a naive render would
 * exercise the desktop branch and prove nothing about the narrow row. The
 * regression being guarded — a second hamburger creeping back into the date
 * row — breaks neither the build nor any render.
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

const here = dirname(fileURLToPath(import.meta.url));
const calendarTab = readFileSync(
  resolve(here, "../src/schedule/CalendarTab.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

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

  it("no longer draws its own toggle in the date row", () => {
    // The symbol, not the JSX: re-adding either the import or the element
    // fails, and there is no other legitimate use of it in this file.
    expect(calendarTab).not.toContain("RightSidebarToggle");
  });

  it("took the hand-rolled copy with it", () => {
    // These two catalog keys had exactly one call site, here. Leaving the
    // reference behind would resurrect them.
    expect(calendarTab).not.toMatch(/scheduleScreen\.(open|close)Menu/);
  });
});
