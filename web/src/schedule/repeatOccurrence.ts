import type { ScheduleItem } from "@life-editor/shared";

/*
 * The occurrence a repeat-row jump landed on (#1678 / #1830).
 *
 * Pressing a row in the Repeats list moves the calendar to the series' next
 * date, but the OCCURRENCE's id is not known at that moment: nothing on the
 * nav path materialises one, so the row only appears once that day's range
 * has been fetched. Both things the panel can ask for — "edit detail" and
 * "show the next one" — therefore park the ROUTINE id and wait for a row of
 * that series to turn up on the anchored day.
 *
 * Out here rather than inline in CalendarTab so the rule has a test: that host
 * needs the whole Provider chain plus real layout, and jsdom has neither
 * (rules/frontend.md §テスト環境の制約).
 *
 * The date is part of the match and not an afterthought. A series has a row on
 * many days inside the fetched window, and taking the first one would open —
 * or ring — an occurrence on some other day than the one the calendar just
 * moved to.
 */
export function pickRepeatOccurrence<
  T extends Pick<ScheduleItem, "id" | "routineId" | "date">,
>(items: readonly T[], routineId: string, dateKey: string): T | null {
  return (
    items.find((i) => i.routineId === routineId && i.date === dateKey) ?? null
  );
}
