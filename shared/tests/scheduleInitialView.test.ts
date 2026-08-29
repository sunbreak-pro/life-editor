import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveInitialCalendarView,
  SCHEDULE_INITIAL_VIEW_STORAGE_KEY,
  SCHEDULE_INITIAL_VIEWS,
  DEFAULT_SCHEDULE_INITIAL_VIEW,
} from "../src/hooks/useScheduleInitialView";

/*
 * Schedule initial-view preference (#1174) — the pure resolver useCalendarNav
 * seeds its `view` state with. No React: jsdom provides localStorage and each
 * test starts from a clean slate.
 *
 * What matters here is that the resolver can never hand the calendar a string
 * it cannot draw. `view` used to be the literal "week", so nothing downstream
 * has ever had to survive a bad value; now the value comes from storage, which
 * a user can edit, an older build can have written, and a future option can
 * outlive.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("resolveInitialCalendarView", () => {
  it("falls back to the week view when nothing is stored", () => {
    expect(resolveInitialCalendarView()).toBe("week");
    expect(DEFAULT_SCHEDULE_INITIAL_VIEW).toBe("week");
  });

  it("returns each offered choice verbatim", () => {
    for (const view of SCHEDULE_INITIAL_VIEWS) {
      localStorage.setItem(SCHEDULE_INITIAL_VIEW_STORAGE_KEY, view);
      expect(resolveInitialCalendarView()).toBe(view);
    }
  });

  it("maps the retired Mobile option strings onto Desktop views", () => {
    // #467 retired list/time; a browser that stored one still has to open.
    localStorage.setItem(SCHEDULE_INITIAL_VIEW_STORAGE_KEY, "list");
    expect(resolveInitialCalendarView()).toBe("day");
    localStorage.setItem(SCHEDULE_INITIAL_VIEW_STORAGE_KEY, "time");
    expect(resolveInitialCalendarView()).toBe("week");
  });

  it("falls back to the default for a value it does not recognise", () => {
    localStorage.setItem(SCHEDULE_INITIAL_VIEW_STORAGE_KEY, "quarter");
    expect(resolveInitialCalendarView()).toBe("week");
  });

  it("is swept by a preferences reset (the key stays in the namespace)", () => {
    expect(SCHEDULE_INITIAL_VIEW_STORAGE_KEY.startsWith("life-editor-")).toBe(
      true,
    );
  });
});
