import type { TranslationKey } from "@life-editor/shared";

/*
 * Which "nothing here" sentence a day list should show (#774).
 *
 * The Mobile day view can be pointed at ANY day — the month sheet hands back a
 * date, and the arrows step one day at a time — but its empty state always read
 * "今日の予定はありません". Scrolling back to June and being told nothing is
 * scheduled *today* is a sentence about a day the user is not looking at.
 *
 * The Dayflow tab keeps `emptyToday` unconditionally: that list IS today's, so
 * for it the two branches would say the same thing.
 *
 * Pure data, for the same reason as taskChipPanel.ts and unsavedCloseGuard.ts:
 * CalendarTab needs the whole Provider stack plus real layout to render, so a
 * decision made inside it is invisible to every test we can afford to run.
 * Pinned in web/tests/agendaEmptyLabel.test.ts.
 */
export function agendaEmptyKey(
  anchorDate: string,
  today: string,
): TranslationKey {
  return anchorDate === today
    ? "scheduleScreen.emptyToday"
    : "scheduleScreen.emptyDay";
}
