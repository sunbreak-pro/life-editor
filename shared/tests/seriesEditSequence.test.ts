import { describe, it, expect, vi } from "vitest";
import { runSeriesEdit } from "../src/utils/seriesEditSequence";

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
