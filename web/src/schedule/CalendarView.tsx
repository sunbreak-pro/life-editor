import { useMemo, useState } from "react";
import {
  useCalendarContext,
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
 * i18n: the web build has no i18n table yet (a real one arrives with
 * the Settings S-step — same as ScheduleView / NotesView). English-only,
 * matching the established web convention (S4-3/4/5 一貫).
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

  const { allTags } = useWikiTagsUnifiedContext();
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
      <p className="text-sm text-lumen-text-secondary">Loading calendars…</p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-lumen-text-secondary">
        Could not load calendars: {error}
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-lumen-border p-3">
      <h2 className="text-sm font-semibold text-lumen-text">
        Calendars ({calendars.length})
      </h2>

      {tags.length === 0 ? (
        <p className="text-sm text-lumen-text-secondary">
          タグを先に作成してください。カレンダーは既存の life-tag が付いた
          アイテム群のビューです (tag が 0 件のため作成不可)。
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                handleCreate();
              }
            }}
            placeholder="Calendar title"
            className="min-w-[10rem] flex-1 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-sm text-lumen-text"
          />
          <select
            value={newTagId}
            onChange={(e) => setNewTagId(e.target.value)}
            aria-label="Life tag"
            className="min-w-[8rem] flex-1 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-sm text-lumen-text"
          >
            <option value="">Select a tag…</option>
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
            Add
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {calendars.map((cal) => (
          <li
            key={cal.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-lumen-border p-2"
          >
            <input
              type="text"
              value={cal.title}
              onChange={(e) =>
                updateCalendar(cal.id, { title: e.target.value })
              }
              aria-label={`Title for ${cal.title}`}
              className="min-w-[8rem] flex-1 rounded-md border border-lumen-border bg-lumen-bg px-2 py-1 text-sm text-lumen-text"
            />
            <span className="text-xs text-lumen-text-secondary">
              tag: {tagNameById.get(cal.tagId) ?? cal.tagId}
            </span>
            <button
              type="button"
              onClick={() => deleteCalendar(cal.id)}
              className="rounded-md border border-lumen-border px-2 py-0.5 text-xs text-lumen-text hover:bg-lumen-hover"
            >
              Delete
            </button>
          </li>
        ))}
        {calendars.length === 0 && (
          <li className="text-sm text-lumen-text-secondary">
            No calendars yet.
          </li>
        )}
      </ul>
    </section>
  );
}
