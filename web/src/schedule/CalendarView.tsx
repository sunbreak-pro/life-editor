import { useState } from "react";
import { useCalendarContext } from "@life-editor/shared";

/*
 * Web Schedule UI — S4-6 Calendars slice.
 *
 * Lean, purpose-built notion-token view (NOT a port of the Tauri
 * calendar grid — intentionally out of scope, plan §スコープ外). It
 * exercises every shared `calendars` data path S4-6 exposes: create
 * (title + folderId — a calendar is a folder-scoped view, folder_id FKs
 * tasks(id)), inline title edit, physical delete. `calendars` has NO
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

  const [newTitle, setNewTitle] = useState("");
  const [newFolderId, setNewFolderId] = useState("");

  const handleCreate = () => {
    const title = newTitle.trim();
    const folderId = newFolderId.trim();
    if (!title || !folderId) return;
    createCalendar(title, folderId);
    setNewTitle("");
    setNewFolderId("");
  };

  if (isLoading) {
    return (
      <p className="text-sm text-notion-text-secondary">Loading calendars…</p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-notion-text-secondary">
        Could not load calendars: {error}
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-notion-border p-3">
      <h2 className="text-sm font-semibold text-notion-text">
        Calendars ({calendars.length})
      </h2>

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
          className="min-w-[10rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
        />
        <input
          type="text"
          value={newFolderId}
          onChange={(e) => setNewFolderId(e.target.value)}
          placeholder="Folder (task) id"
          aria-label="Folder task id"
          className="min-w-[8rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md border border-notion-border px-3 py-1 text-sm text-notion-text hover:bg-notion-hover"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {calendars.map((cal) => (
          <li
            key={cal.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-notion-border p-2"
          >
            <input
              type="text"
              value={cal.title}
              onChange={(e) =>
                updateCalendar(cal.id, { title: e.target.value })
              }
              aria-label={`Title for ${cal.title}`}
              className="min-w-[8rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
            />
            <span className="text-xs text-notion-text-secondary">
              folder: {cal.folderId}
            </span>
            <button
              type="button"
              onClick={() => deleteCalendar(cal.id)}
              className="rounded-md border border-notion-border px-2 py-0.5 text-xs text-notion-text hover:bg-notion-hover"
            >
              Delete
            </button>
          </li>
        ))}
        {calendars.length === 0 && (
          <li className="text-sm text-notion-text-secondary">
            No calendars yet.
          </li>
        )}
      </ul>
    </section>
  );
}
