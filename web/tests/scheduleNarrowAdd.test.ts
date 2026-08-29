import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * #1034 / #1148 — narrow Schedule creates events from a heading row, not from a
 * floating "+".
 *
 * Asserted on source text, which is the sanctioned escape hatch for this one
 * surface: CalendarTab needs the full Provider chain plus real layout to mount,
 * so no web test renders it (rules/frontend.md §テスト環境の制約,
 * D-20260812-refactor-2). The regressions being guarded — a resurrected FAB, a
 * re-inlined copy of the pill, or the FAB's 96px bottom clearance left behind
 * as a blank strip — break neither the build nor any render.
 *
 * WHICH heading row moved in #1148: narrow's day list was retired, so the pill
 * went to the drawer's own flow-tab heading, beside the day caption. #1034's
 * argument is unchanged — a create button in a heading OUTSIDE the scroller,
 * not floating over content — so what this file guards is unchanged too; only
 * the file holding the pill is different.
 *
 * "narrow Schedule" is three files: the host that decides what the flow tab
 * shows, the layout that draws the grid, and the sidebar that draws the list.
 * The "not present anywhere" assertions read all three joined, because a FAB
 * creeping back into any of them has to fail whichever file happens to hold
 * it. The proximity assertion does NOT: files joined put unrelated text within
 * reach of each other, so it is scoped to the sidebar alone.
 *
 * The pill itself is covered properly, shared-side, in
 * `shared/tests/addPill.test.tsx`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) =>
  readFileSync(resolve(here, rel), "utf8").replace(/\r\n/g, "\n");

const hostSource = read("../src/schedule/CalendarTab.tsx");
const layoutSource = read("../src/schedule/CalendarNarrowLayout.tsx");
const sidebarSource = read("../src/schedule/ScheduleSidebar.tsx");
const narrowSource = [hostSource, layoutSource, sidebarSource].join("\n");

describe("narrow Schedule add affordance (#1034)", () => {
  it("no longer hosts the floating +", () => {
    // Covers the import block and the narrow return in one assertion: this was
    // the component's last host in the repo.
    expect(narrowSource).not.toContain("MobileFab");
  });

  it("uses the shared pill with the new label", () => {
    expect(narrowSource).toContain("AddPill");
    expect(narrowSource).toContain('t("scheduleScreen.addCta")');
  });

  it("does not re-inline the pill's recipe", () => {
    // The 6-token accent-pill class string. A copy of it in here means the
    // extraction was undone locally, which is what the DoD's 「同一の部品」
    // forbids.
    expect(narrowSource).not.toContain("text-lumen-on-accent shadow-lumen-sm");
  });

  it("drops the clearance the FAB needed", () => {
    // pb-24 (96px) existed so the FAB could not cover the last agenda row.
    // With the FAB gone it is just a blank strip under the list.
    expect(narrowSource).not.toContain("pb-24");
  });

  it("puts the pill in the flow tab's heading row, beside the day caption", () => {
    // Proximity, not position: it pins that the pill sits in the caption row
    // rather than dropped somewhere else in the panel. Where it sits WITHIN
    // that row is flex order, which jsdom cannot answer.
    //
    // The sidebar alone, and the rendered caption rather than the bare
    // identifier — joined sources put unrelated text within reach.
    expect(sidebarSource).toMatch(
      /\{flow\.todayLabel\}[\s\S]{0,400}<AddPill/,
    );
  });

  it("keeps the pill out of the retired day list's file", () => {
    // #1148 removed narrow's day list. A pill reappearing in the layout would
    // mean the list came back with it, or that a second create route was added
    // where the ruling put none.
    expect(layoutSource).not.toContain("AddPill");
  });
});
