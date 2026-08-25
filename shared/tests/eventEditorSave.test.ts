// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  seriesPropagatableFields,
  touchesSeries,
} from "../src/utils/eventEditorSave";
import type { ScheduleItem } from "../src/types/schedule";

/*
 * The call site (web/src/schedule/useScheduleMutations.ts) hands these a
 * `Partial<ScheduleItem>`, which structurally satisfies SeriesEditablePatch
 * while carrying occurrence-only fields the patch type never lists — `memo`
 * being the one this suite asserts about. Building those fixtures at the call
 * site's type keeps the assertion honest without loosening the patch type
 * (#711).
 */
const patch = (p: Partial<ScheduleItem>): Partial<ScheduleItem> => p;

/*
 * seriesPropagatableFields / touchesSeries (#279 / #469 / #628) — the rule that
 * decides whether one edit is a question about a repeat, and what a routine
 * template may be updated with once the user has answered it.
 *
 * Two regressions this exists to prevent:
 *
 *   - a batched save (#628) that mixes a day move with a retitle losing its
 *     series question entirely, because the old test bailed out on the sight
 *     of a date, and
 *   - the fallback span an all-day flip drags along (timedSpanForAllDayOff)
 *     reaching the template and rewriting a whole series' hours to a made-up
 *     09:00–10:00.
 */

describe("touchesSeries — is this edit a question about the repeat?", () => {
  it("says yes for the fields a routine template also holds", () => {
    expect(touchesSeries({ title: "Gym (long)" })).toBe(true);
    expect(touchesSeries({ startTime: "19:00", endTime: "21:00" })).toBe(true);
  });

  it("says no for fields the template has nowhere to put", () => {
    // No concrete date, no all-day flag, no memo on a template — nothing to
    // propagate to, so nothing to ask about (this is what seriesEditHint
    // promises the user).
    expect(touchesSeries({ date: "2026-08-03" })).toBe(false);
    expect(touchesSeries(patch({ memo: "bring the card" }))).toBe(false);
    expect(touchesSeries({})).toBe(false);
  });

  it("still asks when a batched save mixes both halves", () => {
    // #628 regression: one press can now carry a retitle AND a day move. Losing
    // the question here would apply the new title to this occurrence alone,
    // silently, with no dialog and no sign anything was skipped.
    expect(touchesSeries({ title: "Gym (long)", date: "2026-08-03" })).toBe(
      true,
    );
  });

  it("never asks about an all-day flip, times included (#469)", () => {
    // Turning all-day OFF hands the row a computed fallback span. It is not a
    // time the user chose, so it must not raise a question about the series —
    // and must not reach the template either (see below).
    expect(
      touchesSeries({
        isAllDay: false,
        startTime: "09:00",
        endTime: "10:00",
      }),
    ).toBe(false);
    expect(touchesSeries({ isAllDay: true })).toBe(false);
  });
});

describe("seriesPropagatableFields — what the template may receive", () => {
  it("passes title and times through", () => {
    expect(
      seriesPropagatableFields({
        title: "Gym (long)",
        startTime: "19:00",
        endTime: "21:00",
      }),
    ).toEqual({
      title: "Gym (long)",
      startTime: "19:00",
      endTime: "21:00",
    });
  });

  it("drops the occurrence-only fields of a mixed patch", () => {
    expect(
      seriesPropagatableFields(
        patch({
          title: "Gym (long)",
          date: "2026-08-03",
          memo: "bring the card",
        }),
      ),
    ).toEqual({ title: "Gym (long)" });
  });

  it("withholds the times that came along with an all-day flip", () => {
    // The user pressed a switch that says "all-day". Writing 09:00–10:00 onto
    // the routine from that would move every future occurrence in the series.
    expect(
      seriesPropagatableFields({
        title: "Gym (long)",
        isAllDay: false,
        startTime: "09:00",
        endTime: "10:00",
      }),
    ).toEqual({ title: "Gym (long)" });
  });

  it("returns nothing for a purely occurrence-level patch", () => {
    expect(
      seriesPropagatableFields(patch({ date: "2026-08-03", memo: "note" })),
    ).toEqual({});
  });
});
