import { useMemo, useState } from "react";
import {
  isImeComposing,
  useCalendarContext,
  useTranslation,
  useWikiTagsUnifiedContext,
} from "@life-editor/shared";

/*
 * Web Schedule UI — S4-6 Calendars slice (life-tags S2 rebind, Issue #231).
 *
 * Lean, purpose-built lumen-token view (NOT a port of the Tauri
 * calendar grid — intentionally out of scope, plan §スコープ外). It
 * exercises every shared `calendars` data path S4-6 exposes: create
 * (title + tagId — a calendar is now a life-tag-scoped view; tag_id FKs
 * wiki_tags(id) with ON DELETE CASCADE per migration 0021), inline title
 * edit, physical delete.
 *
 * bug1 fix (carried through S2): the bind id is not free-text. A free-text
 * id that does not exist in wiki_tags(id) would raise 409
 * calendars_tag_id_fkey on insert. It is a <select> over the active
 * life-tags from useWikiTagsUnifiedContext (`allTags` is already
 * soft-delete filtered by the service). If no tag exists, Add is disabled
 * with a hint.
 *
 * `calendars` has NO
 * trash path (S4-0: 0006 omits is_deleted — physical-delete only), so
 * there is deliberately no Restore section here (cf. ScheduleItemsView).
 *
 * i18n (#468): every string is keyed under `scheduleScreen.*` in both
 * catalogs. It shipped English-only with a stray Japanese paragraph in the
 * middle, which is exactly the state this ledger left behind once it became
 * a surface the user visits to manage a working filter, not a dev scratch
 * screen.
 *
 * Dangling tag (#468): `calendars.tag_id` FKs `wiki_tags(id)` ON DELETE
 * CASCADE, but a tag is SOFT-deleted — the row survives, so the cascade never
 * fires and the calendar is left pointing at a tag no list will return. Such a
 * calendar can only ever match zero items, so it is called out here (and kept
 * out of the grid's chip row) with delete as the only action. Adding
 * `is_deleted` to `calendars` would be DDL for a state the UI can simply
 * detect.
 *
 * ...but ONLY once the tags are actually in hand. "Not loaded yet" and "the
 * fetch failed" both look exactly like "deleted" from a lookup miss, and the
 * two are not hypothetical here: this view's `isLoading` covers the calendars
 * only, and `useCalendarsAPI` returns from one small fetch while
 * `useWikiTagsUnifiedAPI` awaits tags + fully-paginated assignments +
 * connections, so the calendars almost always win the race. Reporting a
 * deletion in that window would strike out every row and leave physical
 * delete — which `calendars` has no trash for — as the only offered action, on
 * data that is about to arrive intact. `tagsLoading` gates both that verdict
 * and the "create a tag first" line, which misreads the same way.
 */

export function CalendarView() {
  const {
    calendars,
    isLoading,
    error,
    createCalendar,
    updateCalendar,
    deleteCalendar,
  } = useCalendarContext();

  const { t } = useTranslation();
  // `loading` here means "no data yet" (it stays false across background
  // refetches — see the #300 note in useWikiTagsUnifiedAPI), which is exactly
  // the window in which a lookup miss must not be read as a deletion.
  const { allTags, loading: tagsLoading } = useWikiTagsUnifiedContext();
  // `allTags` is already active-only (the service filters is_deleted=false),
  // so every entry is a valid FK target for calendars.tag_id.
  const tags = useMemo(
    () => allTags.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [allTags],
  );
  const tagNameById = useMemo(
    () => new Map(tags.map((t) => [t.id, t.name])),
    [tags],
  );
  // "The tag list is genuinely in hand." An empty list with `loading` already
  // false is the fetch-failure shape (`refresh` has no catch, so a throw leaves
  // `allTags` at [] and flips loading off), and it is indistinguishable from a
  // deletion by lookup alone — so neither state gets to claim one.
  const tagsResolved = !tagsLoading && tags.length > 0;

  const [newTitle, setNewTitle] = useState("");
  const [newTagId, setNewTagId] = useState("");

  const handleCreate = () => {
    const title = newTitle.trim();
    const tagId = newTagId;
    if (!title || !tagId) return;
    // Guard: only allow ids that resolve to a known active tag — a
    // stale/soft-deleted id would still trip calendars_tag_id_fkey (409).
    if (!tagNameById.has(tagId)) return;
    createCalendar(title, tagId);
    setNewTitle("");
    setNewTagId("");
  };

  if (isLoading) {
    return (
      <p className="text-sm text-lumen-text-secondary">
        {t("scheduleScreen.calendarsLoading")}
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-lumen-text-secondary">
        {t("scheduleScreen.calendarsLoadError", { error })}
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-lumen-border p-3">
      <h2 className="text-sm font-semibold text-lumen-text">
        {t("scheduleScreen.calendarsHeadingCount", { count: calendars.length })}
      </h2>

      {tagsLoading ? (
        <p className="text-sm text-lumen-text-secondary">
          {t("scheduleScreen.calendarTagsLoading")}
        </p>
      ) : tags.length === 0 ? (
        <p className="text-sm text-lumen-text-secondary">
          {t("scheduleScreen.calendarsNoTags")}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isImeComposing(e)) {
                handleCreate();
              }
            }}
            placeholder={t("scheduleScreen.calendarTitlePlaceholder")}
            className="min-w-[10rem] flex-1 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-sm text-lumen-text"
          />
          <select
            value={newTagId}
            onChange={(e) => setNewTagId(e.target.value)}
            aria-label={t("scheduleScreen.calendarTagSelectLabel")}
            className="min-w-[8rem] flex-1 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-sm text-lumen-text"
          >
            <option value="">
              {t("scheduleScreen.calendarTagSelectPlaceholder")}
            </option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newTitle.trim() || !newTagId}
            className="rounded-md border border-lumen-border px-3 py-1 text-sm text-lumen-text hover:bg-lumen-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("scheduleScreen.calendarAdd")}
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {calendars.map((cal) => {
          // A soft-deleted tag stays in the table, so the ON DELETE CASCADE
          // never fires and this row survives pointing at nothing any list
          // returns. Renaming it would only make a broken filter look tidy —
          // delete is the only action left.
          //
          // But a lookup miss only MEANS that once the tag list is genuinely
          // in hand (`tagsResolved`). Mid-load, or after a failed fetch, the
          // row keeps its editable title and shows the raw tag id instead of
          // accusing the user of a deletion they did not make.
          const tagName = tagNameById.get(cal.tagId);
          const tagMissing = tagsResolved && tagName == null;
          return (
            <li
              key={cal.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-lumen-border p-2"
            >
              {tagMissing ? (
                <span className="min-w-[8rem] flex-1 truncate px-2 py-1 text-sm text-lumen-text-secondary line-through">
                  {cal.title}
                </span>
              ) : (
                <input
                  type="text"
                  value={cal.title}
                  onChange={(e) =>
                    updateCalendar(cal.id, { title: e.target.value })
                  }
                  aria-label={t("scheduleScreen.calendarTitleAria", {
                    title: cal.title,
                  })}
                  className="min-w-[8rem] flex-1 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-sm text-lumen-text"
                />
              )}
              {tagMissing ? (
                <span className="text-xs text-lumen-danger">
                  {t("scheduleScreen.calendarTagMissing")}
                </span>
              ) : (
                <span className="text-xs text-lumen-text-secondary">
                  {t("scheduleScreen.calendarTagPrefix", {
                    name: tagName ?? cal.tagId,
                  })}
                </span>
              )}
              <button
                type="button"
                onClick={() => deleteCalendar(cal.id)}
                className="rounded-md border border-lumen-border px-2 py-0.5 text-xs text-lumen-text hover:bg-lumen-hover"
              >
                {t("scheduleScreen.calendarDelete")}
              </button>
            </li>
          );
        })}
        {calendars.length === 0 && (
          <li className="text-sm text-lumen-text-secondary">
            {t("scheduleScreen.calendarsEmpty")}
          </li>
        )}
      </ul>
    </section>
  );
}
