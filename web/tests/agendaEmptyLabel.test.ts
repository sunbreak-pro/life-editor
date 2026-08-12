import { describe, it, expect } from "vitest";
import { agendaEmptyKey } from "../src/schedule/agendaEmptyLabel";

/*
 * #774 — the Mobile day view told the user about the wrong day.
 *
 * Its empty state was `emptyToday` unconditionally, so stepping the month
 * sheet back to June and landing on an empty 1 June still read "今日の予定は
 * ありません" — a sentence about a day that is not on screen.
 *
 * The list is reachable at any date (arrows step a day, the month sheet jumps),
 * so what has to hold is the comparison itself. CalendarTab needs the whole
 * Provider chain to render, hence the decision is pinned here rather than
 * through the markup (same arrangement as taskChipPanel / unsavedCloseGuard).
 */
const TODAY = "2026-08-12";

describe("agendaEmptyKey (#774)", () => {
  it("keeps the today wording when the day on screen IS today", () => {
    expect(agendaEmptyKey(TODAY, TODAY)).toBe("scheduleScreen.emptyToday");
  });

  it("names the day instead when the user has moved off today", () => {
    // The reported case: the month sheet walked back to June.
    expect(agendaEmptyKey("2026-06-01", TODAY)).toBe("scheduleScreen.emptyDay");
  });

  it("does the same for a future day", () => {
    // Not a "past days only" rule — tomorrow is not today either.
    expect(agendaEmptyKey("2026-08-13", TODAY)).toBe("scheduleScreen.emptyDay");
  });

  it("compares the whole key, not the month it falls in", () => {
    // Same month, same year, different day: still not today.
    expect(agendaEmptyKey("2026-08-01", TODAY)).toBe("scheduleScreen.emptyDay");
  });
});
