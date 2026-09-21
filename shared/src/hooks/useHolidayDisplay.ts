import { useLocalStorage } from "./useLocalStorage";

/*
 * How holidays are drawn (#1626, #1802). Two persisted keys:
 *   - `life-editor-schedule-holiday-color`  = the hex ALL holidays wear
 *   - `life-editor-schedule-holidays-hidden` = whether they are drawn at all
 *
 * One colour for all of them, by the Issue's own rule. A holiday says "this
 * day is a day off", and that is one fact; per-holiday colours would turn the
 * month into a rainbow that encodes nothing, since the NAME already tells
 * 敬老の日 from 秋分の日.
 *
 * Visibility is a SETTING and not a session filter (#1802, decision
 * D-20260919-sched-5 = B). The calendar's other two filters deliberately reset
 * on reload, because a restored filter shows a day that is missing most of
 * itself and the next event gets booked into a slot that only looks free.
 * Holidays cannot do that: they hide rows the user did not create and cannot
 * book over, so there is no free-looking slot to make. What is left is a
 * preference about the calendar's furniture, and re-hiding them every session
 * is the cost of treating it as anything else.
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

export const HOLIDAY_HIDDEN_STORAGE_KEY =
  "life-editor-schedule-holidays-hidden";

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

/**
 * Whether holidays are drawn at all, value + setter (#1802).
 *
 * Same shape and the same two readers as the colour above: the Settings card
 * and the calendar toolbar both hold this one hook, so a change made on
 * either side is the one the other sees. The setter takes an updater so the
 * toolbar's toggle stays a flip rather than a read-then-write.
 *
 * Anything unparseable reads as "shown". A holiday the user cannot see and
 * cannot explain is the worse of the two failures — the toolbar button is
 * right there to hide them again.
 */
export function useHolidayVisibilityPref(): {
  holidaysHidden: boolean;
  setHolidaysHidden: (value: boolean | ((prev: boolean) => boolean)) => void;
} {
  const [holidaysHidden, setHolidaysHidden] = useLocalStorage<boolean>(
    HOLIDAY_HIDDEN_STORAGE_KEY,
    false,
    {
      serialize: (v) => JSON.stringify(v),
      deserialize: (raw) => raw === "true",
    },
  );
  return { holidaysHidden, setHolidaysHidden };
}
