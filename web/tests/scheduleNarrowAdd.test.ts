import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * #1034 — narrow Schedule creates events from the day-list header, not from a
 * floating "+".
 *
 * Asserted on source text, which is the sanctioned escape hatch for this one
 * file: CalendarTab needs the full Provider chain plus real layout to mount, so
 * no web test renders it (rules/frontend.md §テスト環境の制約,
 * D-20260812-refactor-2). The regressions being guarded — a resurrected FAB, a
 * re-inlined copy of the pill, or the FAB's 96px bottom clearance left behind
 * as a blank strip — break neither the build nor any render.
 *
 * The pill itself is covered properly, shared-side, in
 * `shared/tests/addPill.test.tsx`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const calendarTab = readFileSync(
  resolve(here, "../src/schedule/CalendarTab.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("narrow Schedule add affordance (#1034)", () => {
  it("no longer hosts the floating +", () => {
    // Covers the import block and the narrow return in one assertion: this was
    // the component's last host in the repo.
    expect(calendarTab).not.toContain("MobileFab");
  });

  it("uses the shared pill with the new label", () => {
    expect(calendarTab).toContain("AddPill");
    expect(calendarTab).toContain('t("scheduleScreen.addCta")');
  });

  it("does not re-inline the pill's recipe", () => {
    // The 6-token accent-pill class string. A copy of it in here means the
    // extraction was undone locally, which is what the DoD's 「同一の部品」
    // forbids.
    expect(calendarTab).not.toContain("text-lumen-on-accent shadow-lumen-sm");
  });

  it("drops the clearance the FAB needed", () => {
    // pb-24 (96px) existed so the FAB could not cover the last agenda row.
    // With the FAB gone it is just a blank strip under the list.
    expect(calendarTab).not.toContain("pb-24");
  });

  it("puts the pill in the day-list header, beside the day caption", () => {
    // Proximity, not position: it pins that the pill was added to the caption
    // row rather than dropped somewhere else in a 1,600-line file. Where it
    // sits WITHIN that row is flex order, which jsdom cannot answer.
    expect(calendarTab).toMatch(/anchorDayLabel[\s\S]{0,400}AddPill/);
  });
});
