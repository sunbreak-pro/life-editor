/**
 * "Updated today 14:05" for a note touched today, "Updated 11/3" otherwise
 * (#2576) — in the device's own time zone, which is the day the user means.
 * One function for the side list's rows and the recent-notes cards, so a note
 * reads the same in both places (#2852).
 */
export function formatNoteUpdated(
  iso: string,
  now: Date,
  labels: {
    updatedToday: (time: string) => string;
    updatedOn: (date: string) => string;
  },
): string | undefined {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return undefined;
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();
  if (sameDay) {
    const hh = String(at.getHours()).padStart(2, "0");
    const mm = String(at.getMinutes()).padStart(2, "0");
    return labels.updatedToday(`${hh}:${mm}`);
  }
  return labels.updatedOn(`${at.getMonth() + 1}/${at.getDate()}`);
}
