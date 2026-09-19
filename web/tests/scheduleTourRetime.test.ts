import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * #1747 — the tour's 3/10 step waits on a TIME change, and the click panel is
 * the shortest way for a user to make one.
 *
 * What broke: #1664 gave the bubble its own `onRetime`, wired straight to the
 * bare `handleUpdate`. The event moved, so nothing looked wrong — but the tour
 * report lives in the WRAPPER (`handleUpdateReported`), so the step sat on
 * 3/10 forever. Only the detail pane's Save, which does go through the
 * wrapper, advanced it. A silent half-failure: no error, no test, just a tour
 * that cannot be finished from the fastest route through it.
 *
 * Asserted on source text, which is the sanctioned escape hatch for this one
 * surface: CalendarTab needs the full Provider chain plus real layout to
 * mount, so no web test renders it (rules/frontend.md §テスト環境の制約,
 * D-20260812-refactor-2 — the same hatch scheduleNarrowAdd.test.ts and the
 * host half of scheduleTourTodos.test.tsx take for the same file). It is also
 * the only form available here that does not depend on coordinates: the bubble
 * opens from a click on a positioned event block, and jsdom has no layout
 * (CLAUDE.md §7.1), so the real route in cannot be driven at all.
 *
 * The load-bearing assertion is the LAST one. Naming the two known callers
 * fixes today's wiring; counting the bare calls is what catches the NEXT write
 * path someone adds beside them — which is exactly how this one arrived.
 *
 * The step's own choreography (which action advances which step, in what
 * order) is asserted shared-side in tourScheduleSteps.test.tsx.
 */

const here = dirname(fileURLToPath(import.meta.url));
const hostSource = readFileSync(
  resolve(here, "../src/schedule/CalendarTab.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("Schedule tour — the host's event time writes (#1124 / #1747)", () => {
  it("reports a time change from the wrapper, off the patch", () => {
    // Read off the patch rather than the item: both callers send only the
    // fields that changed, and a rename must NOT advance the step.
    expect(hostSource).toMatch(
      /const handleUpdateReported =[\s\S]{0,400}patch\.startTime !== undefined \|\| patch\.endTime !== undefined[\s\S]{0,200}TOUR_ACTIONS\.scheduleEventTimeChanged/,
    );
  });

  it("hands the detail pane's save the wrapped updater", () => {
    expect(hostSource).toContain("onSave: handleUpdateReported");
  });

  it("hands the click panel's retime the wrapped updater", () => {
    // The #1747 regression itself: `onRetime` called handleUpdate directly.
    expect(hostSource).toMatch(
      /onRetime: \(id, next\) =>\s*handleUpdateReported\(/,
    );
  });

  it("keeps the bare updater to the wrapper's own body", () => {
    // `handleUpdateReported(` does not match — the character after
    // "handleUpdate" is `R`, not `(` — so every hit here is a raw call, and
    // the one legitimate raw call is the wrapper delegating to it.
    const rawCalls = hostSource.match(/handleUpdate\(/g) ?? [];
    expect(rawCalls).toHaveLength(1);

    const wrapper = hostSource.slice(
      hostSource.indexOf("const handleUpdateReported ="),
    );
    expect(wrapper).toContain("handleUpdate(id, patch);");
  });
});
