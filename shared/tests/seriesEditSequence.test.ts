// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, vi } from "vitest";
import {
  runSeriesEdit,
  planRepeatScopeChoice,
  fillRangeUpToAnchor,
  type RepeatScopeRequest,
} from "../src/utils/seriesEditSequence";

/*
 * #504 — the ordering rule, pinned. The bug it replaces was invisible by
 * construction (occurrences right, template stale, nothing on screen able to
 * say so), so the guarantee worth holding is structural: the template write
 * happens BEFORE any occurrence is touched, and its failure stops everything.
 */

describe("runSeriesEdit", () => {
  it("writes the template before propagating to occurrences", async () => {
    const order: string[] = [];
    const outcome = await runSeriesEdit({
      prepare: async () => {
        order.push("prepare");
        return true;
      },
      writeTemplate: async () => {
        order.push("template");
        return true;
      },
      propagate: async () => {
        order.push("propagate");
        return true;
      },
    });
    expect(outcome).toBe("ok");
    expect(order).toEqual(["prepare", "template", "propagate"]);
  });

  it("touches no occurrence when the template write does not land", async () => {
    const propagate = vi.fn(async () => true);
    const outcome = await runSeriesEdit({
      writeTemplate: async () => false,
      propagate,
    });
    expect(outcome).toBe("template-failed");
    // This is the whole point: "nothing was saved" has to be TRUE when the
    // caller says it.
    expect(propagate).not.toHaveBeenCalled();
  });

  it("stops before the template when prepare reports a partial fill", async () => {
    const writeTemplate = vi.fn(async () => true);
    const propagate = vi.fn(async () => true);
    const outcome = await runSeriesEdit({
      prepare: async () => false,
      writeTemplate,
      propagate,
    });
    expect(outcome).toBe("prepare-failed");
    // Rewriting the series after a partial fill erases days the user did not
    // select — they only exist once materialised.
    expect(writeTemplate).not.toHaveBeenCalled();
    expect(propagate).not.toHaveBeenCalled();
  });

  it("skips prepare when the scope does not need it", async () => {
    const order: string[] = [];
    const outcome = await runSeriesEdit({
      writeTemplate: async () => {
        order.push("template");
        return true;
      },
      propagate: async () => {
        order.push("propagate");
        return true;
      },
    });
    expect(outcome).toBe("ok");
    expect(order).toEqual(["template", "propagate"]);
  });

  it("tells a lost propagation apart from a clean run", async () => {
    // Review of #514: this used to be the one step whose failure had no
    // verdict, so the call site's bare `catch` swallowed it. The state it
    // leaves — new template, old occurrences — is visible on reload but reads
    // as "the edit did nothing", which is the opposite of what happened.
    const outcome = await runSeriesEdit({
      writeTemplate: async () => true,
      propagate: async () => false,
    });
    expect(outcome).toBe("propagate-failed");
  });

  it("lets a thrown step propagate to the caller", async () => {
    // The call site already wraps this in try/finally to reload; swallowing
    // here would turn a hard failure into a silent "ok".
    await expect(
      runSeriesEdit({
        writeTemplate: async () => true,
        propagate: async () => {
          throw new Error("network");
        },
      }),
    ).rejects.toThrow("network");
  });
});

/*
 * #1642 W7 — the six branches of the scope dialog, as data.
 *
 * They used to live inside a 209-line hook callback that needed a jsdom host,
 * a routines store and four injected writes to reach at all, so what the
 * branches DECIDE (which write, anchored on which day, after filling which
 * days) could only be inferred from which mock got called. Here it is read
 * directly.
 */

const TODAY = "2026-09-16";

const template = {
  title: "Morning run",
  startTime: "07:00",
  endTime: "07:30",
};

function editRequest(
  over: Partial<RepeatScopeRequest["item"]> = {},
  patch: RepeatScopeRequest["patch"] = { title: "Evening run" },
): RepeatScopeRequest {
  return {
    mode: "edit",
    item: { id: "occ-1", date: "2026-09-20", routineId: "r-1", ...over },
    patch,
  };
}

describe("fillRangeUpToAnchor", () => {
  it("asks for the days between today and a future anchor, anchor excluded", () => {
    // The anchor day itself is the one the user DID select — filling it would
    // materialise a row the edit is about to rewrite anyway.
    expect(fillRangeUpToAnchor("2026-09-20", TODAY)).toEqual({
      startDate: TODAY,
      endDate: "2026-09-19",
    });
  });

  it("asks for nothing when the anchor is today or already past", () => {
    expect(fillRangeUpToAnchor(TODAY, TODAY)).toBeNull();
    expect(fillRangeUpToAnchor("2026-09-10", TODAY)).toBeNull();
  });

  it("still asks for today when the anchor is tomorrow", () => {
    // The narrowest non-empty range there is, and it has to stay non-empty:
    // today's occurrence is a day the user did NOT select, so it has to exist
    // with the pre-edit values before the series is rewritten.
    expect(fillRangeUpToAnchor("2026-09-17", TODAY)).toEqual({
      startDate: TODAY,
      endDate: TODAY,
    });
  });
});

describe("planRepeatScopeChoice", () => {
  it("writes nothing for a row that turned out to have no series", () => {
    const plan = planRepeatScopeChoice({
      request: editRequest({ routineId: null }),
      scope: "all",
      routine: template,
      today: TODAY,
    });
    expect(plan).toEqual({ kind: "none" });
  });

  it("touches one row for 'this'", () => {
    const plan = planRepeatScopeChoice({
      request: editRequest(),
      scope: "this",
      routine: template,
      today: TODAY,
    });
    expect(plan).toEqual({
      kind: "patch-occurrence",
      id: "occ-1",
      patch: { title: "Evening run" },
    });
  });

  it("degrades to a single-row edit when the routine is not loaded", () => {
    // Propagating without the pre-edit template would drop the manual-edit
    // protection (tier-1 §Schedule rule 2).
    const plan = planRepeatScopeChoice({
      request: editRequest(),
      scope: "all",
      routine: undefined,
      today: TODAY,
    });
    expect(plan.kind).toBe("patch-occurrence");
  });

  it("anchors 'future' on the occurrence's day and fills up to it", () => {
    const plan = planRepeatScopeChoice({
      request: editRequest(),
      scope: "future",
      routine: template,
      today: TODAY,
    });
    expect(plan).toMatchObject({
      kind: "edit-series",
      routineId: "r-1",
      fromDate: "2026-09-20",
      fill: { startDate: TODAY, endDate: "2026-09-19" },
      template,
      updates: { title: "Evening run" },
    });
  });

  it("anchors 'all' on the epoch and fills nothing", () => {
    const plan = planRepeatScopeChoice({
      request: editRequest(),
      scope: "all",
      routine: template,
      today: TODAY,
    });
    expect(plan).toMatchObject({ fromDate: "0000-01-01", fill: null });
  });

  it("carries only the fields a template can hold", () => {
    // An all-day flip drags a fallback span along, and neither it nor the day
    // may reach the template (#469 / #628).
    const plan = planRepeatScopeChoice({
      request: editRequest(
        {},
        {
          title: "Evening run",
          date: "2026-09-21",
          isAllDay: true,
          startTime: "09:00",
        },
      ),
      scope: "all",
      routine: template,
      today: TODAY,
    });
    expect(plan).toMatchObject({ updates: { title: "Evening run" } });
    // The occurrence write still gets the patch WHOLE.
    expect(plan).toMatchObject({
      patch: { isAllDay: true, date: "2026-09-21" },
    });
  });

  it("dismisses rather than deletes for 'delete / this'", () => {
    // A plain delete would be revived by the generator (Issue 017).
    const plan = planRepeatScopeChoice({
      request: { ...editRequest(), mode: "delete", patch: undefined },
      scope: "this",
      routine: template,
      today: TODAY,
    });
    expect(plan).toEqual({ kind: "dismiss-occurrence", id: "occ-1" });
  });

  it("detaches from the occurrence's day for 'delete / future'", () => {
    const plan = planRepeatScopeChoice({
      request: { ...editRequest(), mode: "delete", patch: undefined },
      scope: "future",
      routine: template,
      today: TODAY,
    });
    expect(plan).toEqual({
      kind: "detach-series",
      routineId: "r-1",
      id: "occ-1",
      anchor: "2026-09-20",
      fill: { startDate: TODAY, endDate: "2026-09-19" },
      reloadAfterFill: true,
    });
  });

  it("skips the fill for a future delete when the routine is not loaded", () => {
    // Nothing to generate the missing days FROM, so the detach goes ahead on
    // what is already there rather than waiting on a pass that cannot run.
    const plan = planRepeatScopeChoice({
      request: { ...editRequest(), mode: "delete", patch: undefined },
      scope: "future",
      routine: undefined,
      today: TODAY,
    });
    expect(plan).toMatchObject({ fill: null, reloadAfterFill: false });
  });

  it("soft-deletes the whole routine for 'delete / all'", () => {
    const plan = planRepeatScopeChoice({
      request: { ...editRequest(), mode: "delete", patch: undefined },
      scope: "all",
      routine: template,
      today: TODAY,
    });
    expect(plan).toEqual({
      kind: "delete-series",
      routineId: "r-1",
      id: "occ-1",
    });
  });
});
