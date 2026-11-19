/*
 * The line model the old 宣言 (Intention) section used: a section body is a
 * list of LINES (list items count one per line). Nothing writes a 宣言 since
 * D-20261007-briefing-1, and no screen showed what older days still carry,
 * so #2757 removed its reader. `readDailyText` (dailyText.ts) still leaves
 * the section out of the day's one text.
 *
 * `normalizeIntentionText` is that line model's canonical form, and stays the
 * one the focus field reuses (focusSections.ts).
 *
 * Pure module (no React, no DataService) — unit-tested in
 * shared/tests/intentionSection.test.ts.
 */

/**
 * Canonical form of a declaration text: lines trimmed, blank lines dropped.
 * Returns null when nothing remains — the "no declaration" value.
 */
export function normalizeIntentionText(
  text: string | null | undefined,
): string | null {
  if (text === null || text === undefined) return null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return lines.length === 0 ? null : lines.join("\n");
}
