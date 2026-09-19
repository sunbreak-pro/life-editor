import { useLocalStorage } from "./useLocalStorage";

/*
 * The colour every holiday is drawn in (#1626). One persisted key:
 *   - `life-editor-schedule-holiday-color` = the hex ALL holidays wear
 *
 * One colour for all of them, by the Issue's own rule. A holiday says "this
 * day is a day off", and that is one fact; per-holiday colours would turn the
 * month into a rainbow that encodes nothing, since the NAME already tells
 * 敬老の日 from 秋分の日.
 *
 * Local rather than a database row, for the same reason holidays are computed
 * rather than stored (japaneseHolidays' header): a holiday is not the user's
 * data, so a display preference over it needs no table, no DDL and no sync. If
 * "the same colour on every device" is ever asked for it becomes a
 * user-settings row and this hook keeps its shape — exactly how the
 * initial-view pref (#1174) is built.
 *
 * `useLocalStorage` reads once on mount and does not listen for writes made
 * elsewhere, which is enough here: Settings and Schedule are different
 * sections, so the user has to leave the card to look at a calendar and the
 * trip back is what re-reads the key.
 */

export const HOLIDAY_COLOR_STORAGE_KEY = "life-editor-schedule-holiday-color";

/**
 * Fallback colour: the red a Japanese calendar prints a holiday in. Taken from
 * ITEM_COLOR_PRESETS so the default is one of the swatches the picker offers —
 * a default outside the palette would read as "nothing selected" the moment
 * the card is opened.
 */
export const DEFAULT_HOLIDAY_COLOR = "#e03e3e";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * A stored colour we can still paint with, or the default. A hand-edited or
 * empty key therefore degrades to the default rather than to holidays with no
 * face at all.
 */
export function normalizeHolidayColor(raw: string): string {
  const trimmed = raw.trim();
  return HEX_RE.test(trimmed) ? trimmed : DEFAULT_HOLIDAY_COLOR;
}

/**
 * The shared holiday colour, value + setter.
 *
 * Both sides use this: the Settings card to write it, the calendar host to
 * read it. One hook rather than a resolver plus a pref, because the read side
 * is a component too and has nowhere cheaper to put the value.
 */
export function useHolidayColorPref(): {
  holidayColor: string;
  setHolidayColor: (color: string) => void;
} {
  const [holidayColor, setHolidayColor] = useLocalStorage<string>(
    HOLIDAY_COLOR_STORAGE_KEY,
    DEFAULT_HOLIDAY_COLOR,
    { serialize: (v) => v, deserialize: normalizeHolidayColor },
  );
  return { holidayColor, setHolidayColor };
}
