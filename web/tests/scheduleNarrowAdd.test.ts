import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * #1034 — narrow Schedule creates events from the day-list header, not from a
 * floating "+".
 *
 * Asserted on source text, which is the sanctioned escape hatch for this one
 * surface: CalendarTab needs the full Provider chain plus real layout to mount,
 * so no web test renders it (rules/frontend.md §テスト環境の制約,
 * D-20260812-refactor-2). The regressions being guarded — a resurrected FAB, a
 * re-inlined copy of the pill, or the FAB's 96px bottom clearance left behind
 * as a blank strip — break neither the build nor any render.
 *
 * #889 split the narrow return out of CalendarTab into
 * <CalendarNarrowLayout>, so "narrow Schedule" is two files now: the host that
 * decides what the day list is, and the layout that draws it. The four
 * "not present anywhere" assertions read both files joined, because a FAB
 * creeping back into either one has to fail whichever file happens to hold it.
 * The proximity assertion does NOT: two files joined put unrelated text within
 * reach of each other, so it is scoped to the layout alone.
 *
 * The pill itself is covered properly, shared-side, in
 * `shared/tests/addPill.test.tsx`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) =>
  readFileSync(resolve(here, rel), "utf8").replace(/\r\n/g, "\n");

const hostSource = read("../src/schedule/CalendarTab.tsx");
const layoutSource = read("../src/schedule/CalendarNarrowLayout.tsx");
const narrowSource = [hostSource, layoutSource].join("\n");

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

  it("puts the pill in the day-list header, beside the day caption", () => {
    // Proximity, not position: it pins that the pill was added to the caption
    // row rather than dropped somewhere else in the narrow layout. Where it
    // sits WITHIN that row is flex order, which jsdom cannot answer.
    //
    // The layout alone, and the rendered caption rather than the bare
    // identifier. Joined, the two files leave CalendarTab's last bare
    // `anchorDayLabel` only a couple of hundred characters clear of the old
    // 400-char window around the layout's `AddPill` IMPORT line — a margin
    // any ordinary edit to the host's tail erases, and the pair it would then
    // match touches neither the caption row nor the pill sitting in it.
    expect(layoutSource).toMatch(
      /\{day\.anchorDayLabel\}[\s\S]{0,200}<AddPill/,
    );
  });
});
