/**
 * Local-timezone `YYYY-MM-DD` key. Ported from frontend/src/utils/dateKey
 * (only the subset Daily needs). Uses local getFullYear/Month/Date so the
 * key matches the user's calendar day, not UTC.
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
